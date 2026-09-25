"""
Runs the standalone jobs (mltool_jobs.py) on one of two engines:

- bundled: in the sidecar, with the scikit-learn / purged-cv / calibrate Forge ships;
- env: in a Jupyter kernel from Marto's own environment, so results use his exact versions.
  The job source is sent as code; the result comes back as one marked JSON line on stdout.
"""

import asyncio
import inspect
import json
import time
from typing import Any

import forge_probe.artifacts as artifacts_module

from forge_sidecar.services import mltool_jobs
from forge_sidecar.services.notebooks import NotebookService, Session, SessionError

MARKER = '@@FORGE_RESULT@@'
ENV_TIMEOUT = 120.0
IDLE_KERNEL_SECONDS = 600.0


class ToolError(RuntimeError):
	pass


def _job_source() -> str:
	"""artifacts.py + mltool_jobs.py as one script, without the cross-module import."""
	jobs = inspect.getsource(mltool_jobs).replace(
		'from forge_probe.artifacts import calibration, cv_folds\n', ''
	)
	return inspect.getsource(artifacts_module) + '\n' + jobs


def env_script(job: str, params: dict[str, Any]) -> str:
	# Params go in as a JSON string literal, never spliced into code.
	return (
		f'{_job_source()}\n'
		'import json as _json\n'
		f'_params = _json.loads({json.dumps(json.dumps(params))})\n'
		f'print({MARKER!r} + _json.dumps({job}(_params), allow_nan=False))\n'
	)


def parse_result(stdout: str) -> dict[str, Any]:
	for line in reversed(stdout.splitlines()):
		if line.startswith(MARKER):
			return json.loads(line[len(MARKER) :])
	raise ToolError('The environment produced no result')


def file_columns(path: str) -> list[str]:
	import polars as pl

	lower = path.lower()
	if lower.endswith(('.parquet', '.pq')):
		return list(pl.read_parquet_schema(path))
	if lower.endswith(('.csv', '.tsv', '.txt')):
		sep = '	' if lower.endswith('.tsv') else ','
		return list(pl.read_csv(path, n_rows=1, separator=sep).columns)
	raise ToolError('Pick a CSV or Parquet file')


class MlTools:
	def __init__(self, notebooks: NotebookService) -> None:
		self.notebooks = notebooks
		# One warm kernel per environment, reused for a while: a slider shouldn't start Python.
		self._kernels: dict[str, tuple[Session, float]] = {}
		self._lock = asyncio.Lock()

	async def run(self, job: str, params: dict[str, Any], engine: dict[str, Any]) -> dict[str, Any]:
		if job not in ('run_cv', 'run_calibration'):
			raise ToolError(f'Unknown job {job}')
		if engine.get('kind') == 'env':
			return await self._run_env(job, params, engine)
		fn = getattr(mltool_jobs, job)
		try:
			return await asyncio.to_thread(fn, params)
		except Exception as error:
			# Library errors here are about Marto's input (a missing column, a bad splitter
			# setting): show them as the environment engine does, not as a server error.
			raise ToolError(f'{type(error).__name__}: {error}') from error

	async def _kernel(self, engine: dict[str, Any]) -> Session:
		key = json.dumps(engine, sort_keys=True)
		async with self._lock:
			now = time.monotonic()
			for k, (session, used) in list(self._kernels.items()):
				if now - used > IDLE_KERNEL_SECONDS or session.state == 'dead':
					del self._kernels[k]
					await self.notebooks.shutdown(session.id)
			cached = self._kernels.get(key)
			if cached:
				self._kernels[key] = (cached[0], now)
				return cached[0]
			try:
				session = await self.notebooks.start(engine.get('spec'), engine.get('python'), '.')
			except SessionError as error:
				raise ToolError(str(error)) from error
			self._kernels[key] = (session, now)
			return session

	async def _run_env(
		self, job: str, params: dict[str, Any], engine: dict[str, Any]
	) -> dict[str, Any]:
		session = await self._kernel(engine)
		execution = self.notebooks.execute(session.id, env_script(job, params))
		deadline = time.monotonic() + ENV_TIMEOUT
		while execution.status in ('queued', 'running'):
			if time.monotonic() > deadline:
				await self.notebooks.interrupt(session.id)
				raise ToolError(f'The environment took longer than {ENV_TIMEOUT:.0f} s')
			await asyncio.sleep(0.05)
		errors = [o for o in execution.outputs if o['output_type'] == 'error']
		if errors:
			e = errors[-1]
			hint = (
				' (install it in that environment, or use the bundled engine)'
				if e['ename'] in ('ModuleNotFoundError', 'ImportError')
				else ''
			)
			raise ToolError(f'{e["ename"]}: {e["evalue"]}{hint}')
		stdout = ''.join(
			o['text']
			for o in execution.outputs
			if o['output_type'] == 'stream' and o['name'] == 'stdout'
		)
		return parse_result(stdout)

	async def close(self) -> None:
		for session, _ in self._kernels.values():
			await self.notebooks.shutdown(session.id)
		self._kernels.clear()
