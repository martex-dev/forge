import math
from typing import Any, Literal

import httpx
from pydantic import BaseModel

from forge_sidecar.services.cache import TtlCache
from forge_sidecar.services.throttle import TokenBucket

# Binance's market-data-only host: public klines, no API keys and no trading endpoints at all.
BINANCE_API = 'https://data-api.binance.vision/api/v3'
GECKO_API = 'https://api.geckoterminal.com/api/v2'

Interval = Literal['1m', '5m', '15m', '1h', '4h', '1d']
GECKO_TIMEFRAMES: dict[str, tuple[str, int]] = {
	'1m': ('minute', 1),
	'5m': ('minute', 5),
	'15m': ('minute', 15),
	'1h': ('hour', 1),
	'4h': ('hour', 4),
	'1d': ('day', 1),
}
# DexScreener chain ids → GeckoTerminal network ids, where they differ (others match as-is).
GECKO_NETWORKS = {
	'ethereum': 'eth',
	'polygon': 'polygon_pos',
	'avalanche': 'avax',
	'sui': 'sui-network',
	'cronos': 'cro',
	'fantom': 'ftm',
	'gnosischain': 'xdai',
	'hedera': 'hedera-hashgraph',
	'starknet': 'starknet-alpha',
}


class Candle(BaseModel):
	time: int  # bar open, unix seconds (UTC)
	open: float
	high: float
	low: float
	close: float
	volume: float  # in quote currency (USDT on Binance, USD on GeckoTerminal)


class ChartUpstreamError(Exception):
	def __init__(self, status: int, message: str, retry_after: float | None = None) -> None:
		super().__init__(message)
		self.status = status
		self.message = message
		self.retry_after = retry_after


def _candle(t: Any, o: Any, h: Any, lo: Any, c: Any, v: Any) -> Candle | None:
	try:
		values = [float(x) for x in (o, h, lo, c, v)]
		time = int(t)
	except (TypeError, ValueError):
		return None
	if not all(math.isfinite(x) for x in values) or time <= 0:
		return None
	return Candle(
		time=time, open=values[0], high=values[1], low=values[2], close=values[3], volume=values[4]
	)


def _ascending_unique(candles: list[Candle]) -> list[Candle]:
	# lightweight-charts rejects unsorted or duplicate timestamps outright.
	by_time = {c.time: c for c in candles}
	return [by_time[t] for t in sorted(by_time)]


def parse_binance(payload: Any) -> list[Candle]:
	"""Rows: [openTimeMs, o, h, l, c, baseVolume, closeTimeMs, quoteVolume, ...]."""
	candles: list[Candle] = []
	for row in payload if isinstance(payload, list) else []:
		if not isinstance(row, list) or len(row) < 6:
			continue
		volume = row[7] if len(row) > 7 else row[5]
		ms = row[0] if isinstance(row[0], int) else None
		candle = _candle(ms // 1000 if ms else None, row[1], row[2], row[3], row[4], volume)
		if candle:
			candles.append(candle)
	return _ascending_unique(candles)


def parse_gecko(payload: Any) -> list[Candle]:
	"""GeckoTerminal returns data.attributes.ohlcv_list as [ts, o, h, l, c, v], newest first."""
	try:
		rows = payload['data']['attributes']['ohlcv_list']
	except (KeyError, TypeError):
		return []
	candles = [
		c
		for row in rows or []
		if isinstance(row, list) and len(row) >= 6 and (c := _candle(*row[:6]))
	]
	return _ascending_unique(candles)


def _retry_after(response: httpx.Response) -> float | None:
	try:
		return float(response.headers.get('retry-after', ''))
	except ValueError:
		return None


class ChartData:
	"""OHLCV from Binance (CEX) and GeckoTerminal (DEX pools), throttled and briefly cached."""

	def __init__(self, http: httpx.AsyncClient) -> None:
		self.http = http
		self.binance_bucket = TokenBucket(capacity=10, rate_per_sec=5)
		# GeckoTerminal's free API allows ~30 calls/min; stay under it.
		self.gecko_bucket = TokenBucket(capacity=5, rate_per_sec=0.4)
		self.binance_cache = TtlCache(ttl=5, max_stale=600, fail_cooldown=0)
		# GeckoTerminal only refreshes OHLCV about once a minute anyway.
		self.gecko_cache = TtlCache(ttl=30, max_stale=600, fail_cooldown=0)

	async def binance(self, symbol: str, interval: str, limit: int) -> tuple[list[Candle], bool]:
		async def fetch() -> list[dict[str, Any]]:
			await self.binance_bucket.acquire()
			response = await self.http.get(
				f'{BINANCE_API}/klines',
				params={'symbol': symbol, 'interval': interval, 'limit': str(limit)},
				timeout=15.0,
			)
			if response.status_code == 400:
				raise ChartUpstreamError(404, f'Binance has no market {symbol}')
			if response.status_code in (418, 429):
				raise ChartUpstreamError(
					503, 'Binance is rate-limiting requests', _retry_after(response)
				)
			response.raise_for_status()
			return [c.model_dump() for c in parse_binance(response.json())]

		rows, _, stale = await self.binance_cache.get(f'{symbol}:{interval}:{limit}', fetch)
		return [Candle(**r) for r in rows], stale

	async def gecko(
		self, chain: str, pool: str, interval: str, limit: int
	) -> tuple[list[Candle], bool]:
		network = GECKO_NETWORKS.get(chain, chain)
		timeframe, aggregate = GECKO_TIMEFRAMES[interval]

		async def fetch() -> list[dict[str, Any]]:
			await self.gecko_bucket.acquire()
			response = await self.http.get(
				f'{GECKO_API}/networks/{network}/pools/{pool}/ohlcv/{timeframe}',
				params={'aggregate': str(aggregate), 'limit': str(limit), 'currency': 'usd'},
				headers={'Accept': 'application/json;version=20230302'},
				timeout=15.0,
			)
			if response.status_code == 404:
				raise ChartUpstreamError(404, 'GeckoTerminal has no chart for this pool')
			if response.status_code == 429:
				raise ChartUpstreamError(
					503, 'GeckoTerminal is rate-limiting requests', _retry_after(response)
				)
			response.raise_for_status()
			return [c.model_dump() for c in parse_gecko(response.json())]

		key = f'{network}:{pool.lower()}:{interval}:{limit}'
		rows, _, stale = await self.gecko_cache.get(key, fetch)
		return [Candle(**r) for r in rows], stale
