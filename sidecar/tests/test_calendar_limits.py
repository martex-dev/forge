import httpx
import pytest
from fastapi.testclient import TestClient

from forge_sidecar.main import create_app
from forge_sidecar.services.cache import CoolingDown, TtlCache
from forge_sidecar.services.ff_calendar import UpstreamError

TOKEN = 't' * 64
AUTH = {'Authorization': f'Bearer {TOKEN}'}


def test_rate_limit_is_explained_and_not_hammered() -> None:
	calls = 0

	def handler(request: httpx.Request) -> httpx.Response:
		nonlocal calls
		calls += 1
		return httpx.Response(429, headers={'Retry-After': '120'})

	app = create_app(TOKEN, http=httpx.AsyncClient(transport=httpx.MockTransport(handler)))
	with TestClient(app) as client:
		first = client.get('/calendar/week', headers=AUTH)
		second = client.get('/calendar/week', headers=AUTH)
	assert first.status_code == 502
	assert 'rate-limiting' in first.json()['detail']
	# The second request is answered from the cooldown without touching Forex Factory.
	assert second.status_code == 503
	assert 'Retrying automatically in about 2 min' in second.json()['detail']
	assert calls == 1


class Clock:
	def __init__(self) -> None:
		self.now = 0.0

	def __call__(self) -> float:
		return self.now


@pytest.mark.anyio
async def test_cooldown_expires() -> None:
	clock = Clock()
	cache = TtlCache(ttl=60, max_stale=600, clock=clock, fail_cooldown=300)
	attempts = 0

	async def failing() -> str:
		nonlocal attempts
		attempts += 1
		raise UpstreamError('down')

	with pytest.raises(UpstreamError):
		await cache.get('k', failing)
	with pytest.raises(CoolingDown):
		await cache.get('k', failing)
	clock.now += 301
	with pytest.raises(UpstreamError):
		await cache.get('k', failing)
	assert attempts == 2
