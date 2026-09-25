from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI

from forge_sidecar import __version__
from forge_sidecar.auth import TokenAuthMiddleware
from forge_sidecar.routers import calendar, health
from forge_sidecar.services.cache import TtlCache

USER_AGENT = f'Forge/{__version__} (personal desktop app)'


def create_app(
	token: str,
	data_dir: Path | None = None,
	http: httpx.AsyncClient | None = None,
) -> FastAPI:
	"""Every request, including /health and unknown paths, requires the per-launch token."""

	@asynccontextmanager
	async def lifespan(app: FastAPI) -> AsyncIterator[None]:
		owned = http is None
		client = http or httpx.AsyncClient(
			headers={'User-Agent': USER_AGENT}, follow_redirects=True, timeout=15.0
		)
		app.state.http = client
		cache_dir = data_dir / 'cache' if data_dir else None
		# The Forex Factory feed updates hourly and rate-limits aggressive clients.
		app.state.calendar_cache = TtlCache(
			ttl=30 * 60, max_stale=24 * 3600, persist_dir=cache_dir, fail_cooldown=5 * 60
		)
		try:
			yield
		finally:
			if owned:
				await client.aclose()

	app = FastAPI(
		title='Forge sidecar',
		version=__version__,
		lifespan=lifespan,
		# No interactive docs: nothing but Forge main should be talking to this server.
		docs_url=None,
		redoc_url=None,
		openapi_url=None,
	)
	app.add_middleware(TokenAuthMiddleware, token=token)
	app.include_router(health.router)
	app.include_router(calendar.router)
	return app
