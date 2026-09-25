"""
Solana wallet watch by PUBLIC address only (CLAUDE.md §7): balances, token holdings and recent
transactions over JSON-RPC. Nothing here accepts, derives or stores keys, and nothing signs.
"""

import re
import time
from typing import Any

import httpx
from pydantic import BaseModel

from forge_sidecar.services.throttle import TokenBucket

PUBLIC_RPC = 'https://api.mainnet-beta.solana.com'
DEXSCREENER_TOKENS = 'https://api.dexscreener.com/tokens/v1/solana'
SOL_MINT = 'So11111111111111111111111111111111111111112'
TOKEN_PROGRAMS = (
	'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
	'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb',  # Token-2022
)
# Base58, 32-44 chars: a public key. (A 64-byte secret key is ~87-88 chars and is rejected.)
ADDRESS = re.compile(r'^[1-9A-HJ-NP-Za-km-z]{32,44}$')
LAMPORTS = 1_000_000_000
CACHE_TTL = 30.0
# Exchange-sized wallets hold thousands of tokens; price (and list) at most this many.
MAX_PRICED = 300


class RpcError(Exception):
	pass


class Holding(BaseModel):
	mint: str
	symbol: str | None
	name: str | None
	amount: float
	price_usd: float | None
	value_usd: float | None
	image_url: str | None


class WalletTx(BaseModel):
	signature: str
	slot: int
	time: int | None  # epoch seconds
	ok: bool
	memo: str | None


class WalletSnapshot(BaseModel):
	address: str
	sol: float
	sol_price_usd: float | None
	holdings: list[Holding]
	total_usd: float | None
	transactions: list[WalletTx]
	fetched_at: float


def is_address(value: str) -> bool:
	return bool(ADDRESS.match(value))


def parse_token_accounts(result: Any) -> dict[str, float]:
	"""getTokenAccountsByOwner (jsonParsed) → mint → total UI amount, empty accounts dropped."""
	out: dict[str, float] = {}
	for account in (result or {}).get('value', []) if isinstance(result, dict) else []:
		info = (
			(((account or {}).get('account') or {}).get('data') or {})
			.get('parsed', {})
			.get('info', {})
		)
		mint = info.get('mint')
		amount = (info.get('tokenAmount') or {}).get('uiAmount')
		if isinstance(mint, str) and isinstance(amount, int | float) and amount > 0:
			out[mint] = out.get(mint, 0.0) + float(amount)
	return out


def best_pairs(pairs: Any) -> dict[str, dict[str, Any]]:
	"""DexScreener pairs → the most liquid pair per base-token mint."""
	best: dict[str, dict[str, Any]] = {}
	for pair in pairs if isinstance(pairs, list) else []:
		mint = ((pair or {}).get('baseToken') or {}).get('address')
		if not isinstance(mint, str):
			continue
		liquidity = float(((pair.get('liquidity') or {}).get('usd')) or 0)
		current = best.get(mint)
		if current is None or liquidity > float(((current.get('liquidity') or {}).get('usd')) or 0):
			best[mint] = pair
	return best


def build_holdings(amounts: dict[str, float], pairs: dict[str, dict[str, Any]]) -> list[Holding]:
	holdings: list[Holding] = []
	for mint, amount in amounts.items():
		pair = pairs.get(mint) or {}
		base = pair.get('baseToken') or {}
		try:
			price = float(pair['priceUsd']) if pair.get('priceUsd') else None
		except (TypeError, ValueError):
			price = None
		info = pair.get('info') or {}
		holdings.append(
			Holding(
				mint=mint,
				symbol=base.get('symbol'),
				name=base.get('name'),
				amount=amount,
				price_usd=price,
				value_usd=amount * price if price is not None else None,
				image_url=info.get('imageUrl') if isinstance(info, dict) else None,
			)
		)
	# Priced holdings by value first; unpriced (dust, dead tokens) at the end.
	return sorted(holdings, key=lambda h: (h.value_usd is not None, h.value_usd or 0), reverse=True)


class SolanaClient:
	def __init__(self, http: httpx.AsyncClient) -> None:
		self.http = http
		# The public RPC allows ~10 req/s per IP but punishes bursts; stay well below.
		self.bucket = TokenBucket(capacity=4, rate_per_sec=2)
		self.price_bucket = TokenBucket(capacity=5, rate_per_sec=4)
		self._cache: dict[tuple[str, str], WalletSnapshot] = {}

	async def _rpc(self, url: str, method: str, params: list[Any]) -> Any:
		await self.bucket.acquire()
		response = await self.http.post(
			url, json={'jsonrpc': '2.0', 'id': 1, 'method': method, 'params': params}, timeout=20.0
		)
		if response.status_code == 429:
			raise RpcError(
				'The Solana RPC is rate-limiting requests; add a private RPC URL in Secrets'
			)
		response.raise_for_status()
		body = response.json()
		if body.get('error'):
			raise RpcError(str(body['error'].get('message', body['error'])))
		return body.get('result')

	async def snapshot(
		self, address: str, rpc_url: str | None, refresh: bool = False
	) -> WalletSnapshot:
		if not is_address(address):
			raise ValueError('Not a Solana public address')
		url = rpc_url or PUBLIC_RPC
		key = (url, address)
		cached = self._cache.get(key)
		if cached and not refresh and time.time() - cached.fetched_at < CACHE_TTL:
			return cached

		balance = await self._rpc(url, 'getBalance', [address, {'commitment': 'confirmed'}])
		amounts: dict[str, float] = {}
		for program in TOKEN_PROGRAMS:
			result = await self._rpc(
				url,
				'getTokenAccountsByOwner',
				[
					address,
					{'programId': program},
					{'encoding': 'jsonParsed', 'commitment': 'confirmed'},
				],
			)
			for mint, amount in parse_token_accounts(result).items():
				amounts[mint] = amounts.get(mint, 0.0) + amount
		signatures = await self._rpc(url, 'getSignaturesForAddress', [address, {'limit': 20}])

		if len(amounts) > MAX_PRICED:
			amounts = dict(sorted(amounts.items(), key=lambda kv: kv[1], reverse=True)[:MAX_PRICED])
		pairs = await self._prices([SOL_MINT, *amounts.keys()])
		sol_pair = pairs.get(SOL_MINT) or {}
		sol_price = float(sol_pair['priceUsd']) if sol_pair.get('priceUsd') else None
		sol = float((balance or {}).get('value', 0)) / LAMPORTS
		holdings = build_holdings(amounts, pairs)
		values = [h.value_usd for h in holdings if h.value_usd is not None]
		total = (sol * sol_price + sum(values)) if sol_price is not None else None
		snap = WalletSnapshot(
			address=address,
			sol=sol,
			sol_price_usd=sol_price,
			holdings=holdings,
			total_usd=total,
			transactions=[
				WalletTx(
					signature=str(s.get('signature')),
					slot=int(s.get('slot', 0)),
					time=s.get('blockTime'),
					ok=s.get('err') is None,
					memo=s.get('memo'),
				)
				for s in (signatures or [])
				if isinstance(s, dict) and s.get('signature')
			],
			fetched_at=time.time(),
		)
		self._cache[key] = snap
		return snap

	async def _prices(self, mints: list[str]) -> dict[str, dict[str, Any]]:
		pairs: dict[str, dict[str, Any]] = {}
		for i in range(0, len(mints), 30):  # DexScreener takes up to 30 tokens per call
			chunk = mints[i : i + 30]
			await self.price_bucket.acquire()
			try:
				response = await self.http.get(
					f'{DEXSCREENER_TOKENS}/{",".join(chunk)}', timeout=15.0
				)
				response.raise_for_status()
				pairs.update(best_pairs(response.json()))
			except httpx.HTTPError:
				# Prices are a nice-to-have; balances still show without them.
				continue
		return pairs
