import json
import logging
import os
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

import httpx
from fastapi import FastAPI

from forge_sidecar import __version__
from forge_sidecar.auth import TokenAuthMiddleware
from forge_sidecar.routers import (
	calendar,
	chart,
	dex,
	earnings,
	gpu,
	health,
	mt5,
	probe,
	runs,
	solana,
)
from forge_sidecar.services.cache import TtlCache
from forge_sidecar.services.charts import ChartData
from forge_sidecar.services.dexscreener import DexScreener
from forge_sidecar.services.earnings import EarningsService
from forge_sidecar.services.gpu import GpuMonitor
from forge_sidecar.services.mt5 import Mt5Service
from forge_sidecar.services.runs_store import RunsStore
from forge_sidecar.services.solana import SolanaClient

USER_AGENT = f'Forge/{__version__} (personal desktop app)'
logger = logging.getLogger('forge_sidecar')


def write_probe_file(data_dir: Path, port: int, probe_token: str) -> Path:
	"""
	Tells forge-probe (in any terminal or venv) where to stream. Lives in Forge's userData, which
	only this Windows user can read; the token only opens /probe/ws.
	"""
	path = data_dir / 'probe.json'
	path.parent.mkdir(parents=True, exist_ok=True)
	tmp = path.with_suffix('.tmp')
	tmp.write_text(
		json.dumps(
			{'url': f'ws://127.0.0.1:{port}/probe/ws', 'token': probe_token, 'pid': os.getpid()}
		),
		encoding='utf-8',
	)
	tmp.replace(path)
	return path


def remove_probe_file(path: Path, probe_token: str) -> None:
	try:
		# A newer sidecar may already have replaced it; only remove our own.
		if json.loads(path.read_text(encoding='utf-8')).get('token') == probe_token:
			path.unlink()
	except (OSError, ValueError) as error:
		logger.warning('could not remove %s: %s', path, error)


def create_app(
	token: str,
	data_dir: Path | None = None,
	http: httpx.AsyncClient | None = None,
	port: int | None = None,
	probe_token: str | None = None,
) -> FastAPI:
	"""
	Every request, including /health and unknown paths, requires the per-launch token. The
	probe token (generated here unless given) is accepted on /probe/ws only.
	"""
	probe_token = probe_token or secrets.token_urlsafe(32)

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
		app.state.dex = DexScreener(client)
		app.state.charts = ChartData(client)
		app.state.runs = RunsStore(data_dir / 'lab' / 'runs.db' if data_dir else None)
		app.state.gpu = GpuMonitor()
		app.state.mt5 = Mt5Service()
		app.state.solana = SolanaClient(client)
		app.state.earnings = EarningsService(client, cache_dir)
		probe_file = write_probe_file(data_dir, port, probe_token) if data_dir and port else None
		try:
			yield
		finally:
			if probe_file:
				remove_probe_file(probe_file, probe_token)
			app.state.gpu.close()
			app.state.mt5.close()
			app.state.runs.close()
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
	app.add_middleware(TokenAuthMiddleware, token=token, scoped={'/probe/ws': probe_token})
	app.include_router(health.router)
	app.include_router(calendar.router)
	app.include_router(dex.router)
	app.include_router(chart.router)
	app.include_router(probe.router)
	app.include_router(runs.router)
	app.include_router(gpu.router)
	app.include_router(mt5.router)
	app.include_router(solana.router)
	app.include_router(earnings.router)
	return app
