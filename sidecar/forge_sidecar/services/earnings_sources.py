"""
Earnings calendar sources. Each one is parsed into the same EarningsEvent so the service and the
panel don't care where a row came from.

- NASDAQ: the public JSON calendar nasdaq.com itself uses (no key), one day per request. Same
  source and conventions as Marto's market-calendar project (session buckets, market-cap impact).
- Finnhub: /calendar/earnings with an API key; has EPS actuals but no names or market caps.
- Market Calendar: Marto's own deployment, `GET <base>/api/events?kind=earnings&start&end`
  returning its MarketEvent rows.
"""

from datetime import date as Date
from typing import Any, Literal

import httpx
from pydantic import BaseModel

Session = Literal['premarket', 'intraday', 'afterhours', 'unspecified']
Impact = Literal['high', 'medium', 'low']
Source = Literal['nasdaq', 'finnhub', 'market-calendar']

NASDAQ_BASE = 'https://api.nasdaq.com/api'
FINNHUB_BASE = 'https://finnhub.io/api/v1'

# NASDAQ drops connections from non-browser user agents (verified in market-calendar: requests
# hang or fail at the transport level). Load-bearing; don't "clean up".
NASDAQ_HEADERS = {
	'User-Agent': (
		'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
		'(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36'
	),
	'Accept': 'application/json, text/plain, */*',
	'Accept-Language': 'en-US,en;q=0.9',
}

# Index weight is market-cap proportional, so cap is what decides whether a print can move the
# index. Same fixed tiers as market-calendar's impact.ts.
IMPACT_TIERS: list[tuple[float, Impact]] = [(500e9, 'high'), (50e9, 'medium'), (0.0, 'low')]


class EarningsEvent(BaseModel):
	id: str
	# Calendar date in US Eastern time; the session says when in the day.
	date: str
	session: Session
	symbol: str
	name: str | None
	impact: Impact
	market_cap: float | None
	eps_forecast: str | None
	eps_actual: str | None
	eps_previous: str | None
	source: Source


class SourceError(Exception):
	def __init__(self, message: str, retry_after: float | None = None) -> None:
		super().__init__(message)
		self.retry_after = retry_after


def normalize_symbol(raw: str) -> str:
	"""Wikipedia writes BRK.B, NASDAQ writes BRK/B."""
	return raw.strip().upper().replace('/', '.')


def impact_for_cap(cap: float | None) -> Impact:
	if cap is None:
		return 'low'
	return next(impact for floor, impact in IMPACT_TIERS if cap >= floor)


def parse_money(raw: Any) -> float | None:
	text = str(raw or '').replace('$', '').replace(',', '').strip()
	if not text or text.upper() == 'N/A':
		return None
	try:
		return float(text)
	except ValueError:
		return None


def _eps(raw: Any) -> str | None:
	text = str(raw or '').strip()
	return None if not text or text in ('N/A', '$0.00') else text


def _money_eps(value: Any) -> str | None:
	if not isinstance(value, int | float) or isinstance(value, bool):
		return None
	return f'-${abs(value):.2f}' if value < 0 else f'${value:.2f}'


def _event_id(day: str, symbol: str) -> str:
	return f'earnings:{day}:{symbol}'.lower()


# --- NASDAQ -----------------------------------------------------------------------------------

_NASDAQ_SESSIONS: dict[str, Session] = {
	'time-pre-market': 'premarket',
	'time-after-hours': 'afterhours',
}


def parse_nasdaq_rows(day: str, rows: Any) -> list[EarningsEvent]:
	"""`rows` is null on weekends and holidays: nothing scheduled, not an error."""
	events: list[EarningsEvent] = []
	for row in rows if isinstance(rows, list) else []:
		if not isinstance(row, dict):
			continue
		symbol = normalize_symbol(str(row.get('symbol') or ''))
		if not symbol:
			continue
		cap = parse_money(row.get('marketCap'))
		name = str(row.get('name') or '').strip() or None
		events.append(
			EarningsEvent(
				id=_event_id(day, symbol),
				date=day,
				session=_NASDAQ_SESSIONS.get(str(row.get('time') or ''), 'unspecified'),
				symbol=symbol,
				name=name,
				impact=impact_for_cap(cap),
				market_cap=cap,
				eps_forecast=_eps(row.get('epsForecast')),
				eps_actual=None,
				eps_previous=_eps(row.get('lastYearEPS')),
				source='nasdaq',
			)
		)
	return events


async def fetch_nasdaq_day(http: httpx.AsyncClient, day: str) -> list[dict[str, Any]]:
	response = await http.get(
		f'{NASDAQ_BASE}/calendar/earnings',
		params={'date': day},
		headers=NASDAQ_HEADERS,
		timeout=20.0,
	)
	if response.status_code == 429:
		raise SourceError('NASDAQ is rate-limiting requests', retry_after=300)
	if response.status_code >= 400:
		raise SourceError(f'NASDAQ returned HTTP {response.status_code}')
	body = response.json()
	data = body.get('data') if isinstance(body, dict) else None
	rows = data.get('rows') if isinstance(data, dict) else None
	return rows if isinstance(rows, list) else []


# --- Finnhub ----------------------------------------------------------------------------------

_FINNHUB_SESSIONS: dict[str, Session] = {
	'bmo': 'premarket',
	'amc': 'afterhours',
	'dmh': 'intraday',
}


def parse_finnhub(raw: Any, index: set[str] | None) -> list[EarningsEvent]:
	"""
	Finnhub has no names or market caps, so impact comes from index membership: constituents are
	'medium', everything else 'low'. Mega-cap 'high' needs the NASDAQ source.
	"""
	rows = raw.get('earningsCalendar') if isinstance(raw, dict) else None
	events: list[EarningsEvent] = []
	for row in rows if isinstance(rows, list) else []:
		if not isinstance(row, dict):
			continue
		symbol = normalize_symbol(str(row.get('symbol') or ''))
		day = str(row.get('date') or '')
		if not symbol or not _is_iso_date(day):
			continue
		events.append(
			EarningsEvent(
				id=_event_id(day, symbol),
				date=day,
				session=_FINNHUB_SESSIONS.get(str(row.get('hour') or '').lower(), 'unspecified'),
				symbol=symbol,
				name=None,
				impact='medium' if index is not None and symbol in index else 'low',
				market_cap=None,
				eps_forecast=_money_eps(row.get('epsEstimate')),
				eps_actual=_money_eps(row.get('epsActual')),
				eps_previous=None,
				source='finnhub',
			)
		)
	return events


async def fetch_finnhub(http: httpx.AsyncClient, key: str, start: str, end: str) -> Any:
	response = await http.get(
		f'{FINNHUB_BASE}/calendar/earnings',
		params={'from': start, 'to': end},
		# Header, not the `token` query parameter, so the key never lands in a logged URL.
		headers={'X-Finnhub-Token': key},
		timeout=20.0,
	)
	if response.status_code in (401, 403):
		raise SourceError('Finnhub rejected the API key (Settings → Secrets)')
	if response.status_code == 429:
		raise SourceError('Finnhub rate limit reached', retry_after=60)
	if response.status_code >= 400:
		raise SourceError(f'Finnhub returned HTTP {response.status_code}')
	return response.json()


# --- Market Calendar --------------------------------------------------------------------------

_MC_SESSIONS: set[str] = {'premarket', 'intraday', 'afterhours', 'unspecified'}
_MC_IMPACTS: dict[str, Impact] = {'high': 'high', 'medium': 'medium', 'low': 'low'}


def parse_market_calendar(raw: Any) -> list[EarningsEvent]:
	rows = raw.get('events') if isinstance(raw, dict) else raw
	events: list[EarningsEvent] = []
	for row in rows if isinstance(rows, list) else []:
		if not isinstance(row, dict) or row.get('kind') != 'earnings':
			continue
		symbol = normalize_symbol(str(row.get('symbol') or ''))
		day = str(row.get('date') or '')
		if not symbol or not _is_iso_date(day):
			continue
		session = str(row.get('session') or 'unspecified')
		events.append(
			EarningsEvent(
				id=_event_id(day, symbol),
				date=day,
				session=session if session in _MC_SESSIONS else 'unspecified',  # type: ignore[arg-type]
				symbol=symbol,
				name=str(row.get('title') or '').strip() or None,
				impact=_MC_IMPACTS.get(str(row.get('impact') or '').lower(), 'low'),
				market_cap=None,
				eps_forecast=_strip_eps(row.get('forecast')),
				eps_actual=None,
				eps_previous=_strip_eps(row.get('previous')),
				source='market-calendar',
			)
		)
	return events


def _strip_eps(raw: Any) -> str | None:
	"""market-calendar pre-formats 'EPS $2.71 (yr ago)'; the panel labels its own columns."""
	text = str(raw or '').strip().removeprefix('EPS ').removesuffix('(yr ago)')
	return text.strip() or None


async def fetch_market_calendar(http: httpx.AsyncClient, base: str, start: str, end: str) -> Any:
	response = await http.get(
		f'{base.rstrip("/")}/api/events',
		params={'kind': 'earnings', 'start': start, 'end': end},
		timeout=20.0,
		follow_redirects=False,
	)
	location = response.headers.get('location', '')
	if response.is_redirect and 'vercel.com' in location:
		raise SourceError(
			'The Market Calendar deployment is behind Vercel Authentication; '
			'disable it for production or use another source'
		)
	if response.status_code == 404:
		raise SourceError('Market Calendar has no /api/events endpoint yet')
	if response.status_code >= 400 or response.is_redirect:
		raise SourceError(f'Market Calendar returned HTTP {response.status_code}')
	return response.json()


def _is_iso_date(text: str) -> bool:
	try:
		Date.fromisoformat(text)
	except ValueError:
		return False
	return len(text) == 10
