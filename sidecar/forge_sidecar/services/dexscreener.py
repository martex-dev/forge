import time
from typing import Any

import httpx
from pydantic import BaseModel

from forge_sidecar.services.throttle import TokenBucket

API = 'https://api.dexscreener.com'
MAX_PAIRS_PER_CALL = 30
# Below this, 24h volume is mostly wash trading or a dying pool.
MIN_REAL_LIQUIDITY_USD = 10_000


class Windowed(BaseModel):
	m5: float | None = None
	h1: float | None = None
	h6: float | None = None
	h24: float | None = None


class Txns(BaseModel):
	buys: int = 0
	sells: int = 0


class TokenRef(BaseModel):
	address: str
	name: str
	symbol: str


class Link(BaseModel):
	label: str
	url: str


class DexPair(BaseModel):
	chain_id: str
	dex_id: str
	pair_address: str
	url: str
	base: TokenRef
	quote: TokenRef
	price_usd: float | None
	price_native: float | None
	change: Windowed
	volume: Windowed
	txns_h24: Txns
	txns_h1: Txns
	liquidity_usd: float | None
	fdv: float | None
	market_cap: float | None
	created_at: int | None
	image_url: str | None
	links: list[Link]


def _num(value: Any) -> float | None:
	try:
		return float(value) if value is not None else None
	except (TypeError, ValueError):
		return None


def _windowed(raw: Any) -> Windowed:
	raw = raw if isinstance(raw, dict) else {}
	return Windowed(**{k: _num(raw.get(k)) for k in ('m5', 'h1', 'h6', 'h24')})


def _txns(raw: Any) -> Txns:
	raw = raw if isinstance(raw, dict) else {}
	return Txns(buys=int(raw.get('buys') or 0), sells=int(raw.get('sells') or 0))


def _token(raw: Any) -> TokenRef:
	raw = raw if isinstance(raw, dict) else {}
	return TokenRef(
		address=str(raw.get('address', '')),
		name=str(raw.get('name', '')),
		symbol=str(raw.get('symbol', '')),
	)


def _links(info: Any) -> list[Link]:
	if not isinstance(info, dict):
		return []
	links: list[Link] = []
	for w in info.get('websites') or []:
		if isinstance(w, dict) and str(w.get('url', '')).startswith('https://'):
			links.append(Link(label=str(w.get('label') or 'Website'), url=str(w['url'])))
	for s in info.get('socials') or []:
		if isinstance(s, dict) and str(s.get('url', '')).startswith('https://'):
			links.append(Link(label=str(s.get('type') or 'Social').title(), url=str(s['url'])))
	return links


def parse_pair(raw: dict[str, Any]) -> DexPair:
	txns = raw.get('txns') or {}
	info = raw.get('info')
	return DexPair(
		chain_id=str(raw['chainId']),
		dex_id=str(raw.get('dexId', '')),
		pair_address=str(raw['pairAddress']),
		url=str(raw.get('url', '')),
		base=_token(raw.get('baseToken')),
		quote=_token(raw.get('quoteToken')),
		price_usd=_num(raw.get('priceUsd')),
		price_native=_num(raw.get('priceNative')),
		change=_windowed(raw.get('priceChange')),
		volume=_windowed(raw.get('volume')),
		txns_h24=_txns(txns.get('h24')),
		txns_h1=_txns(txns.get('h1')),
		liquidity_usd=_num((raw.get('liquidity') or {}).get('usd')),
		fdv=_num(raw.get('fdv')),
		market_cap=_num(raw.get('marketCap')),
		created_at=int(raw['pairCreatedAt']) if raw.get('pairCreatedAt') else None,
		image_url=info.get('imageUrl') if isinstance(info, dict) else None,
		links=_links(info),
	)


def parse_pairs(payload: Any) -> list[DexPair]:
	"""Handles both {"pairs": [...]} (pairs/search) and bare lists (tokens endpoint)."""
	rows = payload.get('pairs') if isinstance(payload, dict) else payload
	pairs: list[DexPair] = []
	for row in rows or []:
		if isinstance(row, dict) and row.get('chainId') and row.get('pairAddress'):
			try:
				pairs.append(parse_pair(row))
			except (KeyError, ValueError):
				continue
	return pairs


def search_rank(p: DexPair) -> tuple[bool, float, float]:
	"""
	Pools with real liquidity *and* trading first, then by volume. Volume alone surfaces
	wash-traded knockoffs ($3K liquidity, $1.7M "volume"); liquidity alone surfaces dead pools
	with big locked LP and no trades.
	"""
	liquidity = p.liquidity_usd or 0
	volume = p.volume.h24 or 0
	return (liquidity >= MIN_REAL_LIQUIDITY_USD and volume > 0, volume, liquidity)


class DexScreener:
	"""DexScreener client: throttled (they allow ~300 req/min), batched, briefly cached."""

	def __init__(self, http: httpx.AsyncClient, ttl: float = 10.0) -> None:
		self.http = http
		self.ttl = ttl
		self.bucket = TokenBucket(capacity=20, rate_per_sec=4)
		self._cache: dict[str, tuple[float, DexPair]] = {}

	async def _get(self, path: str, params: dict[str, str] | None = None) -> Any:
		await self.bucket.acquire()
		response = await self.http.get(f'{API}{path}', params=params, timeout=15.0)
		response.raise_for_status()
		return response.json()

	async def search(self, query: str) -> list[DexPair]:
		pairs = parse_pairs(await self._get('/latest/dex/search', {'q': query}))
		return sorted(pairs, key=search_rank, reverse=True)[:20]

	async def pairs(self, ids: list[tuple[str, str]]) -> list[DexPair]:
		now = time.monotonic()
		result: dict[str, DexPair] = {}
		missing: dict[str, list[str]] = {}
		for chain, address in ids:
			key = f'{chain}:{address}'.lower()
			hit = self._cache.get(key)
			if hit and now - hit[0] < self.ttl:
				result[key] = hit[1]
			else:
				missing.setdefault(chain, []).append(address)
		for chain, addresses in missing.items():
			for i in range(0, len(addresses), MAX_PAIRS_PER_CALL):
				batch = addresses[i : i + MAX_PAIRS_PER_CALL]
				for pair in parse_pairs(
					await self._get(f'/latest/dex/pairs/{chain}/{",".join(batch)}')
				):
					key = f'{pair.chain_id}:{pair.pair_address}'.lower()
					self._cache[key] = (now, pair)
					result[key] = pair
		# Keep the caller's order; silently drop pairs DexScreener no longer knows.
		ordered = [result.get(f'{c}:{a}'.lower()) for c, a in ids]
		return [p for p in ordered if p is not None]
