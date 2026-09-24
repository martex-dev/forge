from fastapi import FastAPI

from forge_sidecar import __version__
from forge_sidecar.auth import TokenAuthMiddleware
from forge_sidecar.routers import health


def create_app(token: str) -> FastAPI:
	"""Every request, including /health and unknown paths, requires the per-launch token."""
	app = FastAPI(
		title='Forge sidecar',
		version=__version__,
		# No interactive docs: nothing but Forge main should be talking to this server.
		docs_url=None,
		redoc_url=None,
		openapi_url=None,
	)
	app.add_middleware(TokenAuthMiddleware, token=token)
	app.include_router(health.router)
	return app
