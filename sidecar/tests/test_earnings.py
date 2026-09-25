from datetime import date
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from forge_sidecar.main import create_app
from forge_sidecar.services.constituents import parse_nasdaq100, parse_sp500
from forge_sidecar.services.earnings import weekdays
from forge_sidecar.services.earnings_sources import (
	SourceError,
	impact_for_cap,
	parse_finnhub,
	parse_market_calendar,
	parse_nasdaq_rows,
)

TOKEN = 't' * 64
AUTH = {'Authorization': f'Bearer {TOKEN}'}

SP500 = [f'S{i}' for i in range(450)] + ['AAPL', 'BRK.B']
NDX = [{'symbol': f'N{i}'} for i in range(90)] + [{'symbol': 'NVDA'}]


def sp500_html(symbols: list[str]) -> str:
	rows = ''.join(f'<tr><td><a href="#">{s}</a></td><td>Name</td></tr>' for s in symbols)
	# A nested table and an unrelated table must not leak rows into the list.
	return (
		'<table id="other"><tr><td>NOPE</td></tr></table>'
		'<table id="constituents"><tbody><tr><th>Symbol</th></tr>'
		f'{rows}<tr><td><table><tr><td>INNER</td></tr></table></td></tr></tbody></table>'
	)


def nasdaq_row(symbol: str, cap: str, time: str = 'time-after-hours') -> dict[str, Any]:
	return {
		'symbol': symbol,
		'name': f'{symbol} Inc.',
		'time': time,
		'marketCap': cap,
		'epsForecast': '$1.50',
		'lastYearEPS': 'N/A',
	}


def test_impact_tiers_follow_market_cap() -> None:
	assert impact_for_cap(3e12) == 'high'
	assert impact_for_cap(60e9) == 'medium'
	assert impact_for_cap(1e9) == 'low'
	assert impact_for_cap(None) == 'low'


def test_parse_nasdaq_rows() -> None:
	events = parse_nasdaq_rows(
		'2026-10-29',
		[nasdaq_row('AAPL', '$3,500,000,000,000'), nasdaq_row('BRK/B', 'N/A', 'x'), 'junk'],
	)
	assert [(e.symbol, e.impact, e.session) for e in events] == [
		('AAPL', 'high', 'afterhours'),
		('BRK.B', 'low', 'unspecified'),
	]
	assert events[0].eps_forecast == '$1.50'
	assert events[0].eps_previous is None
	assert events[0].id == 'earnings:2026-10-29:aapl'
	assert parse_nasdaq_rows('2026-10-31', None) == []


def test_parse_finnhub_uses_index_for_impact() -> None:
	raw = {
		'earningsCalendar': [
			{'symbol': 'AAPL', 'date': '2026-10-29', 'hour': 'amc', 'epsEstimate': 1.5},
			{'symbol': 'TINY', 'date': '2026-10-29', 'hour': 'bmo', 'epsActual': -0.2},
			{'symbol': 'BAD', 'date': 'soon'},
		]
	}
	events = parse_finnhub(raw, {'AAPL'})
	assert [(e.symbol, e.impact, e.session) for e in events] == [
		('AAPL', 'medium', 'afterhours'),
		('TINY', 'low', 'premarket'),
	]
	assert (events[0].eps_forecast, events[1].eps_actual) == ('$1.50', '-$0.20')


def test_parse_market_calendar_keeps_earnings_only() -> None:
	raw = {
		'events': [
			{
				'kind': 'earnings',
				'date': '2026-10-29',
				'session': 'afterhours',
				'title': 'Apple Inc.',
				'impact': 'High',
				'symbol': 'AAPL',
				'forecast': 'EPS $1.50',
				'previous': 'EPS $1.40 (yr ago)',
			},
			{'kind': 'macro', 'date': '2026-10-29', 'title': 'CPI', 'symbol': None},
		]
	}
	[event] = parse_market_calendar(raw)
	assert (event.symbol, event.impact, event.name) == ('AAPL', 'high', 'Apple Inc.')
	assert (event.eps_forecast, event.eps_previous) == ('$1.50', '$1.40')


def test_constituent_parsers() -> None:
	assert parse_sp500(sp500_html(SP500)) == SP500
	with pytest.raises(SourceError):
		parse_sp500(sp500_html(['AAPL']))
	assert 'NVDA' in parse_nasdaq100({'data': {'data': {'rows': NDX}}})
	assert 'NVDA' in parse_nasdaq100({'data': {'rows': NDX}})


def test_weekdays() -> None:
	assert weekdays(date(2026, 9, 25), date(2026, 9, 29)) == [
		'2026-09-25',
		'2026-09-28',
		'2026-09-29',
	]


def _client(handler: httpx.MockTransport) -> TestClient:
	http = httpx.AsyncClient(transport=handler)
	return TestClient(create_app(token=TOKEN, http=http))


def test_nasdaq_range_filters_to_index_and_reports_failed_days() -> None:
	seen: list[str] = []

	def handler(request: httpx.Request) -> httpx.Response:
		seen.append(request.url.path)
		if 'wikipedia' in request.url.host:
			return httpx.Response(200, text=sp500_html(SP500))
		if request.url.path.endswith('/nasdaq100'):
			return httpx.Response(200, json={'data': {'data': {'rows': NDX}}})
		assert request.headers['user-agent'].startswith('Mozilla/5.0')
		day = request.url.params['date']
		if day == '2026-10-30':
			return httpx.Response(500)
		rows = [nasdaq_row('AAPL', '$3,500,000,000,000'), nasdaq_row('ZZZZ', '$1,000')]
		return httpx.Response(200, json={'data': {'rows': rows}})

	with _client(httpx.MockTransport(handler)) as client:
		res = client.get('/earnings/range?start=2026-10-29&end=2026-11-01', headers=AUTH)
	assert res.status_code == 200
	body = res.json()
	assert [e['symbol'] for e in body['events']] == ['AAPL']
	assert body['failed_dates'] == ['2026-10-30']
	assert body['index_filter'] == 'on'
	# Saturday and Sunday are never requested.
	assert sum(p.endswith('/calendar/earnings') for p in seen) == 2


def test_finnhub_needs_a_key_and_sends_it_in_a_header() -> None:
	def handler(request: httpx.Request) -> httpx.Response:
		if 'finnhub' in request.url.host:
			assert 'token' not in request.url.params
			assert request.headers['x-finnhub-token'] == 'k'
			return httpx.Response(
				200, json={'earningsCalendar': [{'symbol': 'AAPL', 'date': '2026-10-29'}]}
			)
		return httpx.Response(503)

	with _client(httpx.MockTransport(handler)) as client:
		url = '/earnings/range?start=2026-10-29&end=2026-10-30&source=finnhub'
		assert client.get(url, headers=AUTH).status_code == 502
		res = client.get(url, headers={**AUTH, 'X-Finnhub-Token': 'k'})
	assert res.status_code == 200
	# Index lists unavailable: nothing filtered, and the panel is told so.
	assert res.json()['index_filter'] == 'unavailable'
	assert [e['symbol'] for e in res.json()['events']] == ['AAPL']


def test_market_calendar_explains_vercel_auth_and_rejects_plain_http() -> None:
	def handler(request: httpx.Request) -> httpx.Response:
		return httpx.Response(302, headers={'location': 'https://vercel.com/sso-api?x=1'})

	url = '/earnings/range?start=2026-10-29&end=2026-10-30&source=market-calendar'
	with _client(httpx.MockTransport(handler)) as client:
		res = client.get(url, headers={**AUTH, 'X-Market-Calendar-Url': 'https://mc.example'})
		assert res.status_code == 502
		assert 'Vercel Authentication' in res.json()['detail']
		res = client.get(url, headers={**AUTH, 'X-Market-Calendar-Url': 'http://mc.example'})
		assert res.status_code == 422


def test_range_limits() -> None:
	with _client(httpx.MockTransport(lambda r: httpx.Response(500))) as client:
		res = client.get('/earnings/range?start=2026-10-01&end=2026-12-01', headers=AUTH)
	assert res.status_code == 422
