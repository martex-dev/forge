from pathlib import Path

import pytest

from forge_sidecar.services.cache import TtlCache

# AnyIO's pytest plugin ships with Starlette/FastAPI, so no pytest-asyncio dependency.
pytestmark = pytest.mark.anyio


class Clock:
	def __init__(self) -> None:
		self.now = 1000.0

	def __call__(self) -> float:
		return self.now


async def test_serves_fresh_value_without_refetching() -> None:
	clock = Clock()
	cache = TtlCache(ttl=60, max_stale=600, clock=clock)
	calls = 0

	async def fetch() -> int:
		nonlocal calls
		calls += 1
		return calls

	assert (await cache.get('k', fetch))[0] == 1
	clock.now += 30
	assert (await cache.get('k', fetch))[0] == 1
	clock.now += 31
	assert (await cache.get('k', fetch))[0] == 2
	assert calls == 2


async def test_serves_stale_copy_when_refresh_fails_then_gives_up() -> None:
	clock = Clock()
	cache = TtlCache(ttl=60, max_stale=600, clock=clock)

	async def ok() -> str:
		return 'good'

	async def broken() -> str:
		raise RuntimeError('upstream down')

	await cache.get('k', ok)
	clock.now += 120
	value, _, stale = await cache.get('k', broken)
	assert (value, stale) == ('good', True)
	clock.now += 600
	with pytest.raises(RuntimeError):
		await cache.get('k', broken)


async def test_persists_across_instances(tmp_path: Path) -> None:
	clock = Clock()

	async def fetch() -> dict[str, int]:
		return {'n': 1}

	await TtlCache(ttl=60, max_stale=600, persist_dir=tmp_path, clock=clock).get('ff-week', fetch)

	async def must_not_fetch() -> dict[str, int]:
		raise AssertionError('should have used the persisted copy')

	value, _, stale = await TtlCache(ttl=60, max_stale=600, persist_dir=tmp_path, clock=clock).get(
		'ff-week', must_not_fetch
	)
	assert (value, stale) == ({'n': 1}, False)
