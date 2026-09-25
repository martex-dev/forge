import json
from typing import Any

import httpx
from fastapi.testclient import TestClient

from forge_sidecar.main import create_app
from forge_sidecar.services.solana import SOL_MINT, is_address, parse_token_accounts

TOKEN = 't' * 64
AUTH = {'Authorization': f'Bearer {TOKEN}'}
WALLET = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM'
BONK = 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
DEAD = 'Ddead1111111111111111111111111111111111111'


def token_account(mint: str, amount: float) -> dict[str, Any]:
	return {
		'account': {
			'data': {'parsed': {'info': {'mint': mint, 'tokenAmount': {'uiAmount': amount}}}}
		}
	}


def handler(calls: list[str]) -> Any:
	def respond(request: httpx.Request) -> httpx.Response:
		if request.url.host == 'api.dexscreener.com':
			calls.append('prices')
			return httpx.Response(
				200,
				json=[
					{
						'baseToken': {'address': SOL_MINT, 'symbol': 'SOL'},
						'priceUsd': '150',
						'liquidity': {'usd': 1e7},
					},
					{
						'baseToken': {'address': BONK, 'symbol': 'BONK'},
						'priceUsd': '0.00002',
						'liquidity': {'usd': 1e3},
					},
					{
						'baseToken': {'address': BONK, 'symbol': 'BONK'},
						'priceUsd': '0.000025',
						'liquidity': {'usd': 5e6},
					},
				],
			)
		body = json.loads(request.content)
		calls.append(f'{request.url.host}:{body["method"]}')
		method = body['method']
		if method == 'getBalance':
			result: Any = {'value': 2_500_000_000}
		elif method == 'getTokenAccountsByOwner':
			tokenkeg = body['params'][1]['programId'].startswith('Tokenkeg')
			result = {
				'value': [
					token_account(BONK, 1_000_000),
					token_account(DEAD, 5),
					token_account(BONK, 0),
				]
				if tokenkeg
				else []
			}
		else:
			result = [
				{
					'signature': '5sig',
					'slot': 10,
					'blockTime': 1_790_000_000,
					'err': None,
					'memo': None,
				},
				{'signature': '6sig', 'slot': 9, 'blockTime': None, 'err': {'x': 1}, 'memo': 'hi'},
			]
		return httpx.Response(200, json={'jsonrpc': '2.0', 'id': 1, 'result': result})

	return respond


def _client(calls: list[str]) -> TestClient:
	http = httpx.AsyncClient(transport=httpx.MockTransport(handler(calls)))
	return TestClient(create_app(TOKEN, http=http))


def test_address_validation_rejects_private_keys() -> None:
	assert is_address(WALLET)
	# A 64-byte secret key in base58 is ~88 characters: never accepted as an "address".
	assert not is_address('4' * 88)
	assert not is_address('0OIl' * 10)  # not base58


def test_parse_token_accounts_sums_and_drops_empty() -> None:
	accounts = {'value': [token_account(BONK, 2), token_account(BONK, 3), token_account(DEAD, 0)]}
	assert parse_token_accounts(accounts) == {BONK: 5.0}
	assert parse_token_accounts(None) == {}


def test_wallet_snapshot_prices_and_caches() -> None:
	calls: list[str] = []
	with _client(calls) as client:
		res = client.get('/solana/wallet', params={'address': WALLET}, headers=AUTH)
		data = res.json()
		assert res.status_code == 200
		assert data['sol'] == 2.5 and data['sol_price_usd'] == 150
		# Most liquid BONK pair wins; unpriced tokens go last.
		assert [(h['symbol'], h['value_usd']) for h in data['holdings']] == [
			('BONK', 25.0),
			(None, None),
		]
		assert data['total_usd'] == 2.5 * 150 + 25
		assert [t['ok'] for t in data['transactions']] == [True, False]
		n = len(calls)
		client.get('/solana/wallet', params={'address': WALLET}, headers=AUTH)
		assert len(calls) == n  # served from the 30 s cache
		client.get('/solana/wallet', params={'address': WALLET, 'refresh': True}, headers=AUTH)
		assert len(calls) > n


def test_custom_rpc_goes_in_a_header_and_must_be_https() -> None:
	calls: list[str] = []
	with _client(calls) as client:
		ok = client.get(
			'/solana/wallet',
			params={'address': WALLET},
			headers={**AUTH, 'X-Solana-Rpc': 'https://rpc.example.com/?api-key=secret'},
		)
		assert ok.status_code == 200 and 'rpc.example.com:getBalance' in calls
		bad = client.get(
			'/solana/wallet',
			params={'address': WALLET},
			headers={**AUTH, 'X-Solana-Rpc': 'http://x'},
		)
		assert bad.status_code == 422
		assert (
			client.get(
				'/solana/wallet', params={'address': '4' * 40 + '0OIl'}, headers=AUTH
			).status_code
			== 422
		)
