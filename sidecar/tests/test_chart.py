from typing import Any

import httpx
from fastapi.testclient import TestClient

from forge_sidecar.main import create_app
from forge_sidecar.services.charts import parse_binance, parse_gecko

TOKEN = 't' * 64
AUTH = {'Authorization': f'Bearer {TOKEN}'}
POOL = '8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj'


def kline(ms: int, close: str) -> list[Any]:
	return [ms, '1.0', '2.0', '0.5', close, '10.0', ms + 3_599_999, '15.5', 42, '5', '7', '0']


def _app(handler: Any) -> TestClient:
	return TestClient(
		create_app(TOKEN, http=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
	)


def test_parse_binance_uses_seconds_and_quote_volume() -> None:
	candles = parse_binance([kline(1_790_330_400_000, '1.5'), ['junk'], kline(0, '1')])
	assert [(c.time, c.close, c.volume) for c in candles] == [(1_790_330_400, 1.5, 15.5)]


def test_parse_gecko_sorts_ascending_and_drops_duplicates_and_bad_rows() -> None:
	payload = {
		'data': {
			'attributes': {
				'ohlcv_list': [
					[300, 1, 2, 0.5, 1.8, 100],
					[100, 1, 2, 0.5, 1.2, 100],
					[200, 1, 2, 0.5, 'nan', 100],
					[100, 1, 2, 0.5, 1.3, 100],
					'junk',
				]
			}
		}
	}
	assert [(c.time, c.close) for c in parse_gecko(payload)] == [(100, 1.3), (300, 1.8)]
	assert parse_gecko({'errors': []}) == []


def test_binance_route_caches_and_maps_unknown_symbol() -> None:
	calls: list[httpx.URL] = []

	def handler(request: httpx.Request) -> httpx.Response:
		calls.append(request.url)
		if request.url.params['symbol'] == 'NOPEUSDT':
			return httpx.Response(400, json={'code': -1121, 'msg': 'Invalid symbol.'})
		return httpx.Response(200, json=[kline(1_000_000, '2'), kline(4_600_000, '3')])

	with _app(handler) as client:
		params = {'symbol': 'BTCUSDT', 'interval': '4h', 'limit': 50}
		first = client.get('/chart/binance', params=params, headers=AUTH)
		client.get('/chart/binance', params=params, headers=AUTH)
		missing = client.get('/chart/binance', params={'symbol': 'NOPEUSDT'}, headers=AUTH)
		invalid = client.get('/chart/binance', params={'symbol': 'btc/usdt'}, headers=AUTH)

	assert first.status_code == 200
	assert [c['close'] for c in first.json()['candles']] == [2, 3]
	assert first.json()['stale'] is False
	assert calls[0].host == 'data-api.binance.vision'
	assert calls[0].params['interval'] == '4h' and calls[0].params['limit'] == '50'
	assert len(calls) == 2  # second BTCUSDT call was served from the cache
	assert missing.status_code == 404 and 'NOPEUSDT' in missing.json()['detail']
	assert invalid.status_code == 422


def test_gecko_route_maps_network_timeframe_and_errors() -> None:
	seen: list[httpx.URL] = []

	def handler(request: httpx.Request) -> httpx.Response:
		seen.append(request.url)
		if 'missing' in request.url.path.lower():
			return httpx.Response(404, json={'errors': [{'status': '404'}]})
		if request.url.params.get('aggregate') == '5':
			return httpx.Response(429, headers={'retry-after': '30'})
		rows = [[60, 1, 1, 1, 1, 1]]
		return httpx.Response(200, json={'data': {'attributes': {'ohlcv_list': rows}}})

	with _app(handler) as client:
		ok = client.get(
			'/chart/gecko',
			params={'chain': 'ethereum', 'pool': '0x' + 'a' * 40, 'interval': '4h'},
			headers=AUTH,
		)
		limited = client.get(
			'/chart/gecko', params={'chain': 'solana', 'pool': POOL, 'interval': '5m'}, headers=AUTH
		)
		missing = client.get(
			'/chart/gecko',
			params={'chain': 'solana', 'pool': 'missing' + 'x' * 20, 'interval': '1h'},
			headers=AUTH,
		)

	assert ok.status_code == 200 and len(ok.json()['candles']) == 1
	assert seen[0].path == f'/api/v2/networks/eth/pools/0x{"a" * 40}/ohlcv/hour'
	assert seen[0].params['aggregate'] == '4' and seen[0].params['currency'] == 'usd'
	assert limited.status_code == 503 and 'rate-limiting' in limited.json()['detail']
	assert missing.status_code == 404


def test_chart_routes_require_token() -> None:
	with _app(lambda request: httpx.Response(500)) as client:
		assert client.get('/chart/binance', params={'symbol': 'BTCUSDT'}).status_code == 401
