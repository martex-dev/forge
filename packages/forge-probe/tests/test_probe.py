import json
import threading
import time
from collections.abc import Iterator
from pathlib import Path
from typing import Any

import pytest
from websockets.sync.server import Server, ServerConnection, serve

import forge_probe
from forge_probe import Endpoint, endpoint_from, read_endpoint

TOKEN = 'p' * 43


class FakeSidecar:
	"""A real WebSocket server standing in for the sidecar's /probe/ws."""

	def __init__(self) -> None:
		self.messages: list[dict[str, Any]] = []
		self.auth: list[str | None] = []
		self.lock = threading.Lock()
		self.server: Server = serve(self._handle, '127.0.0.1', 0)
		self.port = self.server.socket.getsockname()[1]
		threading.Thread(target=self.server.serve_forever, daemon=True).start()

	def _handle(self, ws: ServerConnection) -> None:
		self.auth.append(ws.request.headers.get('Authorization') if ws.request else None)
		for frame in ws:
			with self.lock:
				self.messages.extend(json.loads(frame))

	def endpoint(self) -> Endpoint:
		return Endpoint(url=f'ws://127.0.0.1:{self.port}/probe/ws', token=TOKEN)

	def types(self) -> list[str]:
		with self.lock:
			return [m['type'] for m in self.messages]


@pytest.fixture
def sidecar() -> Iterator[FakeSidecar]:
	server = FakeSidecar()
	yield server
	server.server.shutdown()


def test_streams_start_logs_and_finish(sidecar: FakeSidecar) -> None:
	probe = forge_probe.run(
		'mnist', config={'lr': 1e-3, 'path': Path('data')}, endpoint=sidecar.endpoint
	)
	probe.log(loss=2.5, acc=0.1)
	probe.log(loss=float('nan'))
	with pytest.warns(UserWarning, match='label'):
		probe.log(step=10, loss=1.0, label='x')  # non-numeric: skipped
	probe.finish()

	assert sidecar.auth == [f'Bearer {TOKEN}']
	assert sidecar.types() == ['start', 'log', 'log', 'log', 'finish']
	start, first, second, third, finish = sidecar.messages
	assert start['name'] == 'mnist' and start['config'] == {'lr': 1e-3, 'path': 'data'}
	assert (first['step'], first['metrics']) == (0, {'loss': 2.5, 'acc': 0.1})
	assert (second['step'], second['metrics']) == (1, {'loss': None})
	assert (third['step'], third['metrics']) == (10, {'loss': 1.0})
	assert finish == {'type': 'finish', 'run_id': probe.id, 'status': 'finished', 'error': None}


def test_context_manager_reports_failure(sidecar: FakeSidecar) -> None:
	with pytest.raises(RuntimeError):
		with forge_probe.run('crash', endpoint=sidecar.endpoint) as probe:
			probe.log(loss=1.0)
			raise RuntimeError('CUDA out of memory')
	assert sidecar.messages[-1]['status'] == 'failed'
	assert sidecar.messages[-1]['error'] == 'RuntimeError: CUDA out of memory'


def test_is_a_silent_noop_without_forge() -> None:
	probe = forge_probe.run('offline', endpoint=lambda: None, finish_timeout=5)
	for i in range(100):
		probe.log(loss=float(i))
	started = time.monotonic()
	probe.finish()
	# No server: finish gives up immediately instead of waiting out the timeout.
	assert time.monotonic() - started < 1


def test_buffers_until_forge_appears(sidecar: FakeSidecar) -> None:
	available = threading.Event()
	probe = forge_probe.run(
		'late', endpoint=lambda: sidecar.endpoint() if available.is_set() else None
	)
	probe.log(loss=1.0)
	time.sleep(0.3)
	available.set()
	probe.log(loss=0.5)
	probe.finish()
	assert sidecar.types() == ['start', 'log', 'log', 'finish']


def test_buffer_is_bounded() -> None:
	probe = forge_probe.run('bounded', endpoint=lambda: None, max_buffer=10)
	for i in range(1_000):
		probe.log(loss=float(i))
	assert len(probe._queue) == 10
	probe.finish()


def test_read_endpoint_only_trusts_localhost(tmp_path: Path) -> None:
	path = tmp_path / 'probe.json'
	assert read_endpoint(path) is None
	path.write_text(json.dumps({'url': 'ws://127.0.0.1:5000/probe/ws', 'token': TOKEN}))
	assert read_endpoint(path) == Endpoint('ws://127.0.0.1:5000/probe/ws', TOKEN)
	assert endpoint_from(path)() == read_endpoint(path)
	path.write_text(json.dumps({'url': 'ws://evil.example:80/probe/ws', 'token': TOKEN}))
	assert read_endpoint(path) is None
	path.write_text('{broken')
	assert read_endpoint(path) is None


def test_discovery_file_env_override(monkeypatch: pytest.MonkeyPatch, tmp_path: Path) -> None:
	monkeypatch.setenv('FORGE_PROBE_FILE', str(tmp_path / 'x.json'))
	assert forge_probe.discovery_file() == tmp_path / 'x.json'
	monkeypatch.delenv('FORGE_PROBE_FILE')
	assert forge_probe.discovery_file().parts[-3:] == ('Forge', 'sidecar', 'probe.json')
