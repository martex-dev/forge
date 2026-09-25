from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from forge_sidecar.main import create_app
from forge_sidecar.services.dexscreener import parse_pairs
from forge_sidecar.services.throttle import TokenBucket

TOKEN = 't' * 64
AUTH = {'Authorization': f'Bearer {TOKEN}'}
SOL_PAIR = '8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj'
SOL_PAIR_2 = 'Dqb7bL7MZkuDgHrZZfJ9A2gQX1g8y4c3Gm8K7v9aS5dT'


def pair(
	address: str, symbol: str, price: str, liquidity: float, volume: float = 1_000_000
) -> dict[str, Any]:
	return {
		'chainId': 'solana',
		'dexId': 'raydium',
		'url': f'https://dexscreener.com/solana/{address.lower()}',
		'pairAddress': address,
		'baseToken': {'address': f'{symbol}mint', 'name': symbol.title(), 'symbol': symbol},
		'quoteToken': {'address': 'So111', 'name': 'Wrapped SOL', 'symbol': 'SOL'},
		'priceNative': '0.000001',
		'priceUsd': price,
		'txns': {'h1': {'buys': 10, 'sells': 5}, 'h24': {'buys': 100, 'sells': 80}},
		'volume': {'h24': volume, 'h6': 200_000, 'h1': 40_000, 'm5': 3_000},
		'priceChange': {'m5': 1.2, 'h1': -3.4, 'h24': 25},
		'liquidity': {'usd': liquidity, 'base': 1, 'quote': 2},
		'fdv': 5_000_000,
		'marketCap': 4_000_000,
		'pairCreatedAt': 1_700_000_000_000,
		'info': {
			'imageUrl': 'https://dd.dexscreener.com/img.png',
			'websites': [{'label': 'Website', 'url': 'https://example.com'}],
			'socials': [
				{'type': 'twitter', 'url': 'https://x.com/example'},
				{'type': 'bad', 'url': 'javascript:alert(1)'},
			],
		},
	}


def test_parse_pair_normalizes_numbers_and_links() -> None:
	[p] = parse_pairs({'pairs': [pair(SOL_PAIR, 'BONK', '0.0000213', 1_234_567.0)]})
	assert p.price_usd == pytest.approx(0.0000213)
	assert p.change.h6 is None and p.change.h24 == 25
	assert (p.txns_h24.buys, p.txns_h24.sells) == (100, 80)
	# Only https links survive.
	assert [link.url for link in p.links] == ['https://example.com', 'https://x.com/example']


def test_parse_skips_rows_without_ids() -> None:
	assert parse_pairs({'pairs': [{'chainId': 'solana'}, 'junk', None]}) == []
	assert parse_pairs({'pairs': None}) == []


def _app(handler: Any) -> TestClient:
	return TestClient(
		create_app(TOKEN, http=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
	)


def test_pairs_batches_caches_and_keeps_order() -> None:
	calls: list[str] = []

	def handler(request: httpx.Request) -> httpx.Response:
		calls.append(request.url.path)
		return httpx.Response(
			200,
			json={
				'pairs': [
					pair(SOL_PAIR, 'BONK', '0.00002', 1e6),
					pair(SOL_PAIR_2, 'WIF', '2.1', 3e6),
				]
			},
		)

	ids = f'solana:{SOL_PAIR_2},solana:{SOL_PAIR}'
	with _app(handler) as client:
		first = client.get('/dex/pairs', params={'ids': ids}, headers=AUTH)
		second = client.get('/dex/pairs', params={'ids': ids}, headers=AUTH)
	assert first.status_code == 200
	assert [p['base']['symbol'] for p in first.json()] == ['WIF', 'BONK']
	assert second.json() == first.json()
	# One batched upstream call, then served from the 10 s cache.
	assert calls == [f'/latest/dex/pairs/solana/{SOL_PAIR_2},{SOL_PAIR}']


def test_pairs_rejects_malformed_ids() -> None:
	with _app(lambda r: httpx.Response(200, json={'pairs': []})) as client:
		bad = client.get('/dex/pairs', params={'ids': 'solana:../../etc'}, headers=AUTH)
	assert bad.status_code == 422


def test_search_prefers_traded_pools_and_maps_rate_limit() -> None:
	wash = '0x' + 'a' * 64  # 66-char pool id, as some EVM DEXes use
	dead_pool = pair(SOL_PAIR, 'BONK', '1', liquidity=50e6, volume=0)
	busy_pool = pair(SOL_PAIR_2, 'BONK', '1', liquidity=427_000, volume=1e6)
	wash_pool = pair(wash, 'BONK', '1', liquidity=3_000, volume=1.7e6)

	def ok(request: httpx.Request) -> httpx.Response:
		return httpx.Response(200, json={'pairs': [dead_pool, wash_pool, busy_pool]})

	with _app(ok) as client:
		res = client.get('/dex/search', params={'q': 'bonk'}, headers=AUTH)
	# Real liquidity + trading wins; wash-traded dust and dead pools rank below it.
	assert [p['pair_address'] for p in res.json()] == [SOL_PAIR_2, wash, SOL_PAIR]

	with _app(lambda r: httpx.Response(429)) as client:
		limited = client.get('/dex/search', params={'q': 'bonk'}, headers=AUTH)
	assert limited.status_code == 503
	assert 'rate-limiting' in limited.json()['detail']


class FakeClock:
	def __init__(self) -> None:
		self.now = 0.0

	def __call__(self) -> float:
		return self.now


@pytest.mark.anyio
async def test_token_bucket_spends_then_refills() -> None:
	clock = FakeClock()
	bucket = TokenBucket(capacity=2, rate_per_sec=1, clock=clock)
	await bucket.acquire()
	await bucket.acquire()
	assert bucket.tokens == pytest.approx(0)
	clock.now += 1.5
	await bucket.acquire()
	assert bucket.tokens == pytest.approx(0.5)
