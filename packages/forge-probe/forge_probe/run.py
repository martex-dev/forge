import atexit
import json
import math
import os
import socket
import sys
import threading
import time
import uuid
import warnings
from collections import deque
from collections.abc import Callable, Mapping
from pathlib import Path
from types import TracebackType
from typing import Any

from websockets.exceptions import WebSocketException
from websockets.sync.client import connect

from forge_probe.discovery import Endpoint, read_endpoint

MAX_BATCH = 500
MAX_BACKOFF = 5.0


def _number(value: Any) -> float | None:
	"""float() handles ints, numpy scalars and 1-element torch tensors. NaN/inf become None."""
	number = float(value)
	return number if math.isfinite(number) else None


def _jsonable(config: Mapping[str, Any]) -> dict[str, Any]:
	# Configs often hold paths, dtypes or tensors: keep the structure, stringify the rest.
	return json.loads(json.dumps(dict(config), default=str))


class Run:
	"""
	One training run. Messages are queued and sent by a background thread, so log() never
	blocks training. If Forge isn't running, everything is silently dropped.
	"""

	def __init__(
		self,
		name: str,
		config: Mapping[str, Any] | None = None,
		project: str | None = None,
		*,
		endpoint: Callable[[], Endpoint | None] = read_endpoint,
		flush_interval: float = 0.25,
		max_buffer: int = 10_000,
		finish_timeout: float = 3.0,
	) -> None:
		self.id = uuid.uuid4().hex
		self.name = name
		self._endpoint = endpoint
		self._flush_interval = flush_interval
		self._finish_timeout = finish_timeout
		# Bounded: a script that runs for days without Forge must not grow memory forever.
		self._queue: deque[dict[str, Any]] = deque(maxlen=max_buffer)
		self._wake = threading.Event()
		self._closing = threading.Event()
		self._finished = False
		self._step = -1
		self._warned: set[str] = set()
		self._start = {
			'type': 'start',
			'run_id': self.id,
			'name': name,
			'project': project,
			'config': _jsonable(config or {}),
			'started_at': time.time(),
			'pid': os.getpid(),
			'host': socket.gethostname(),
			'script': os.path.abspath(sys.argv[0]) if sys.argv and sys.argv[0] else None,
		}
		self._error: str | None = None
		self._previous_hook = sys.excepthook
		sys.excepthook = self._excepthook
		atexit.register(self._atexit)
		self._thread = threading.Thread(target=self._pump, name='forge-probe', daemon=True)
		self._thread.start()

	def log(self, step: int | None = None, **metrics: Any) -> None:
		"""Record metrics for a step (auto-incremented when omitted)."""
		if self._finished:
			return
		self._step = self._step + 1 if step is None else int(step)
		values: dict[str, float | None] = {}
		for key, value in metrics.items():
			try:
				values[key] = _number(value)
			except (TypeError, ValueError):
				if key not in self._warned:
					self._warned.add(key)
					warnings.warn(
						f'forge-probe: metric {key!r} is not a number; skipping it',
						stacklevel=2,
					)
		if values:
			self._send(
				{
					'type': 'log',
					'run_id': self.id,
					'step': self._step,
					't': time.time(),
					'metrics': values,
				}
			)

	def finish(self, status: str = 'finished', error: str | None = None) -> None:
		"""Mark the run done and flush (waits at most `finish_timeout` seconds)."""
		if self._finished:
			return
		self._finished = True
		self._send({'type': 'finish', 'run_id': self.id, 'status': status, 'error': error})
		self._closing.set()
		self._wake.set()
		self._thread.join(self._finish_timeout)
		if sys.excepthook == self._excepthook:
			sys.excepthook = self._previous_hook
		atexit.unregister(self._atexit)

	def __enter__(self) -> 'Run':
		return self

	def __exit__(
		self,
		exc_type: type[BaseException] | None,
		exc: BaseException | None,
		tb: TracebackType | None,
	) -> None:
		if exc_type is None:
			self.finish()
		else:
			self.finish('failed', f'{exc_type.__name__}: {exc}')

	def _send(self, message: dict[str, Any]) -> None:
		self._queue.append(message)
		if len(self._queue) >= MAX_BATCH:
			self._wake.set()

	def _excepthook(
		self, exc_type: type[BaseException], exc: BaseException, tb: TracebackType | None
	) -> None:
		self._error = f'{exc_type.__name__}: {exc}'
		self._previous_hook(exc_type, exc, tb)

	def _atexit(self) -> None:
		if self._error:
			self.finish('failed', self._error)
		else:
			self.finish()

	def _drain(self) -> list[dict[str, Any]]:
		batch: list[dict[str, Any]] = []
		while self._queue and len(batch) < MAX_BATCH:
			batch.append(self._queue.popleft())
		return batch

	def _pump(self) -> None:
		backoff = 0.25
		while True:
			endpoint = self._endpoint()
			if endpoint is not None:
				try:
					self._stream(endpoint)
					return
				except (OSError, WebSocketException):
					pass
			if self._closing.is_set():
				return  # Forge isn't reachable and the run is over: drop silently.
			self._closing.wait(backoff)
			backoff = min(backoff * 2, MAX_BACKOFF)

	def _stream(self, endpoint: Endpoint) -> None:
		headers = {'Authorization': f'Bearer {endpoint.token}'}
		with connect(endpoint.url, additional_headers=headers, open_timeout=2) as ws:
			# Re-announce on every (re)connect; the sidecar treats start as an upsert.
			ws.send(json.dumps([self._start]))
			while True:
				batch = self._drain()
				if batch:
					try:
						ws.send(json.dumps(batch))
					except (OSError, WebSocketException):
						# Put it back so the next connection sends it.
						self._queue.extendleft(reversed(batch))
						raise
					continue
				if self._closing.is_set():
					return
				self._wake.wait(self._flush_interval)
				self._wake.clear()


def run(
	name: str,
	config: Mapping[str, Any] | None = None,
	project: str | None = None,
	**options: Any,
) -> Run:
	"""
	Start streaming a run to Forge's Lab room:

		probe = forge_probe.run('mnist', config={'lr': 1e-3})
		probe.log(step=i, loss=loss, acc=acc)
		probe.finish()
	"""
	return Run(name, config, project, **options)


def endpoint_from(path: Path) -> Callable[[], Endpoint | None]:
	"""Read the endpoint from a specific discovery file (tests, custom setups)."""
	return lambda: read_endpoint(path)
