import httpx
import pytest
from fastapi.testclient import TestClient

from forge_sidecar.main import create_app
from forge_sidecar.services.ff_calendar import parse_events

TOKEN = 't' * 64
AUTH = {'Authorization': f'Bearer {TOKEN}'}

FEED = [
	{
		'title': 'Non-Farm Employment Change',
		'country': 'USD',
		'date': '2026-09-25T08:30:00-04:00',
		'impact': 'High',
		'forecast': '150K',
		'previous': '142K',
	},
	{
		'title': 'German ifo Business Climate',
		'country': 'EUR',
		'date': '2026-09-25T04:00:00-04:00',
		'impact': 'Medium',
		'forecast': '',
		'previous': '87.1',
	},
	{
		'title': 'Bank Holiday',
		'country': 'JPY',
		'date': '2026-09-23T00:00:00-04:00',
		'impact': 'Holiday',
	},
	{'title': 'broken row', 'country': 'USD'},
	'not even a dict',
]


def test_parse_normalizes_times_impact_and_blanks() -> None:
	events = parse_events(FEED)
	assert [e.title for e in events] == [
		'Bank Holiday',
		'German ifo Business Climate',
		'Non-Farm Employment Change',
	]
	nfp = events[2]
	assert nfp.time.isoformat() == '2026-09-25T12:30:00+00:00'
	assert (nfp.impact, nfp.currency, nfp.forecast) == ('high', 'USD', '150K')
	assert events[1].forecast is None
	assert events[0].impact == 'holiday'
	assert len({e.id for e in events}) == 3


def test_parse_rejects_non_list() -> None:
	with pytest.raises(ValueError):
		parse_events({'oops': True})


def _client(handler: httpx.MockTransport) -> TestClient:
	http = httpx.AsyncClient(transport=handler)
	return TestClient(create_app(TOKEN, http=http))


def test_week_endpoint_serves_and_caches() -> None:
	calls = 0

	def handler(request: httpx.Request) -> httpx.Response:
		nonlocal calls
		calls += 1
		return httpx.Response(200, json=FEED)

	with _client(httpx.MockTransport(handler)) as client:
		first = client.get('/calendar/week', headers=AUTH)
		second = client.get('/calendar/week', headers=AUTH)
	assert first.status_code == 200
	body = first.json()
	assert body['source'] == 'forexfactory'
	assert body['stale'] is False
	assert len(body['events']) == 3
	assert second.status_code == 200
	assert calls == 1


def test_week_endpoint_reports_upstream_failure() -> None:
	def handler(request: httpx.Request) -> httpx.Response:
		return httpx.Response(503)

	with _client(httpx.MockTransport(handler)) as client:
		response = client.get('/calendar/week', headers=AUTH)
	assert response.status_code == 502
	assert 'Calendar feed unavailable' in response.json()['detail']


def test_week_endpoint_requires_token() -> None:
	with _client(httpx.MockTransport(lambda r: httpx.Response(200, json=FEED))) as client:
		assert client.get('/calendar/week').status_code == 401
