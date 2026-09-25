import asyncio
import hashlib
import logging
import time
from datetime import UTC, date, datetime, timedelta
from pathlib import Path
from typing import Any, Literal

import httpx
from pydantic import BaseModel

from forge_sidecar.services.cache import TtlCache
from forge_sidecar.services.constituents import fetch_constituents
from forge_sidecar.services.earnings_sources import (
	EarningsEvent,
	Source,
	SourceError,
	fetch_finnhub,
	fetch_market_calendar,
	fetch_nasdaq_day,
	parse_finnhub,
	parse_market_calendar,
	parse_nasdaq_rows,
)

logger = logging.getLogger('forge_sidecar.earnings')

MAX_DAYS = 31
# An undocumented endpoint with no published limits: stay polite.
NASDAQ_CONCURRENCY = 4
_SESSION_ORDER = {'premarket': 0, 'intraday': 1, 'afterhours': 2, 'unspecified': 3}
_IMPACT_ORDER = {'high': 0, 'medium': 1, 'low': 2}

IndexFilter = Literal['on', 'off', 'unavailable', 'source']


class EarningsRange(BaseModel):
	source: Source
	start: str
	end: str
	events: list[EarningsEvent]
	fetched_at: float
	stale: bool
	failed_dates: list[str]
	# 'unavailable': the S&P 500 / Nasdaq-100 lists couldn't be loaded, so nothing was filtered.
	# 'source': the source filters itself (Market Calendar).
	index_filter: IndexFilter


def weekdays(start: date, end: date) -> list[str]:
	days: list[str] = []
	d = start
	while d <= end:
		if d.weekday() < 5:
			days.append(d.isoformat())
		d += timedelta(days=1)
	return days


def sort_events(events: list[EarningsEvent]) -> list[EarningsEvent]:
	return sorted(
		events,
		key=lambda e: (
			e.date,
			_SESSION_ORDER[e.session],
			_IMPACT_ORDER[e.impact],
			-(e.market_cap or 0),
			e.symbol,
		),
	)


class EarningsService:
	def __init__(self, http: httpx.AsyncClient, cache_dir: Path | None) -> None:
		self.http = http
		persist = cache_dir / 'earnings' if cache_dir else None
		self.constituents = TtlCache(
			ttl=7 * 86400, max_stale=90 * 86400, persist_dir=persist, fail_cooldown=30 * 60
		)
		# Upcoming days change (dates confirmed, times added); past days are settled.
		self.recent = TtlCache(
			ttl=6 * 3600, max_stale=14 * 86400, persist_dir=persist, fail_cooldown=5 * 60
		)
		self.past = TtlCache(ttl=30 * 86400, max_stale=365 * 86400, persist_dir=persist)
		self.ranged = TtlCache(ttl=3600, max_stale=7 * 86400, persist_dir=persist, fail_cooldown=60)
		self._nasdaq_gate = asyncio.Semaphore(NASDAQ_CONCURRENCY)

	async def index(self) -> set[str] | None:
		try:
			symbols, _, _ = await self.constituents.get(
				'constituents', lambda: fetch_constituents(self.http)
			)
		except Exception as error:  # any failure degrades to "unfiltered"
			logger.warning('index constituents unavailable: %s', error)
			return None
		return set(symbols)

	async def get(
		self,
		source: Source,
		start: date,
		end: date,
		index_only: bool,
		finnhub_key: str | None = None,
		market_calendar_url: str | None = None,
	) -> EarningsRange:
		if end < start or (end - start).days >= MAX_DAYS:
			raise ValueError(f'the range must be 1 to {MAX_DAYS} days')
		if source == 'nasdaq':
			return await self._nasdaq(start, end, index_only)
		if source == 'finnhub':
			if not finnhub_key:
				raise SourceError('Add a Finnhub API key in Settings → Secrets')
			return await self._finnhub(start, end, index_only, finnhub_key)
		if not market_calendar_url:
			raise SourceError('Set the Market Calendar URL in the Earnings panel settings')
		return await self._market_calendar(start, end, market_calendar_url)

	async def _nasdaq(self, start: date, end: date, index_only: bool) -> EarningsRange:
		recent_from = (datetime.now(UTC) - timedelta(days=2)).date().isoformat()

		async def day(d: str) -> tuple[str, Any, float, bool] | tuple[str, Exception]:
			cache = self.recent if d >= recent_from else self.past
			try:
				async with self._nasdaq_gate:
					rows, fetched, stale = await cache.get(
						f'nasdaq-{d}', lambda: fetch_nasdaq_day(self.http, d)
					)
			except Exception as error:  # reported per day in failed_dates
				logger.warning('NASDAQ earnings for %s failed: %s', d, error)
				return (d, error)
			return (d, rows, fetched, stale)

		days = weekdays(start, end)
		results = await asyncio.gather(*(day(d) for d in days))
		failed = [r[0] for r in results if len(r) == 2]
		if days and len(failed) == len(days):
			error = results[0][1]
			raise error if isinstance(error, SourceError) else SourceError(str(error))
		ok = [r for r in results if len(r) == 4]
		events = [e for r in ok for e in parse_nasdaq_rows(r[0], r[1])]
		index = await self.index() if index_only else None
		if index is not None:
			events = [e for e in events if e.symbol in index]
		return EarningsRange(
			source='nasdaq',
			start=start.isoformat(),
			end=end.isoformat(),
			events=sort_events(events),
			fetched_at=min((r[2] for r in ok), default=time.time()),
			stale=any(r[3] for r in ok),
			failed_dates=failed,
			index_filter='off' if not index_only else 'on' if index is not None else 'unavailable',
		)

	async def _finnhub(self, start: date, end: date, index_only: bool, key: str) -> EarningsRange:
		s, e = start.isoformat(), end.isoformat()
		raw, fetched, stale = await self.ranged.get(
			f'finnhub-{s}-{e}', lambda: fetch_finnhub(self.http, key, s, e)
		)
		index = await self.index()
		events = parse_finnhub(raw, index)
		if index_only and index is not None:
			events = [ev for ev in events if ev.symbol in index]
		return EarningsRange(
			source='finnhub',
			start=s,
			end=e,
			events=sort_events(events),
			fetched_at=fetched,
			stale=stale,
			failed_dates=[],
			index_filter='off' if not index_only else 'on' if index is not None else 'unavailable',
		)

	async def _market_calendar(self, start: date, end: date, base: str) -> EarningsRange:
		s, e = start.isoformat(), end.isoformat()
		# The URL is config, not a secret, but hashing keeps it out of cache file names.
		tag = hashlib.blake2b(base.encode(), digest_size=6).hexdigest()
		raw, fetched, stale = await self.ranged.get(
			f'mc-{tag}-{s}-{e}', lambda: fetch_market_calendar(self.http, base, s, e)
		)
		events = [ev for ev in parse_market_calendar(raw) if s <= ev.date <= e]
		return EarningsRange(
			source='market-calendar',
			start=s,
			end=e,
			events=sort_events(events),
			fetched_at=fetched,
			stale=stale,
			failed_dates=[],
			index_filter='source',
		)
