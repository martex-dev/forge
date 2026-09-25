import json
import math
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from forge_sidecar.main import create_app
from forge_sidecar.services.runs_store import MAX_POINTS_PER_FETCH, RunsStore

TOKEN = 't' * 64
PROBE = 'p' * 43
AUTH = {'Authorization': f'Bearer {TOKEN}'}
PROBE_AUTH = {'Authorization': f'Bearer {PROBE}'}
RUN = 'run-0123456789'


def start(run_id: str = RUN, **extra: Any) -> dict[str, Any]:
	return {
		'type': 'start',
		'run_id': run_id,
		'name': 'mnist',
		'config': {'lr': 0.001, 'model': {'layers': 2}},
		'started_at': 1_000.0,
		**extra,
	}


def log(step: int, **metrics: float | None) -> dict[str, Any]:
	return {'type': 'log', 'run_id': RUN, 'step': step, 't': 1_000.0 + step, 'metrics': metrics}


def test_store_upserts_metrics_and_pages_by_cursor() -> None:
	store = RunsStore(None)
	store.start(RUN, 'mnist', {'lr': 0.1}, 1_000.0)
	store.log(RUN, 1, 1.0, {'loss': 2.0, 'acc': 0.1})
	store.log(RUN, 2, 2.0, {'loss': math.nan})
	first = store.metrics(RUN)
	assert [(p.key, p.step, p.value) for p in first.points] == [
		('loss', 1, 2.0),
		('acc', 1, 0.1),
		('loss', 2, None),
	]
	# Re-logging a step replaces it and shows up after the cursor.
	store.log(RUN, 1, 3.0, {'loss': 1.5})
	later = store.metrics(RUN, first.cursor)
	assert [(p.key, p.step, p.value) for p in later.points] == [('loss', 1, 1.5)]
	run = store.get(RUN)
	assert run and run.last_step == 2 and run.metric_keys == ['acc', 'loss']
	assert run.config == {'lr': 0.1}


def test_store_marks_leftover_running_runs_interrupted_on_open(tmp_path: Path) -> None:
	db = tmp_path / 'runs.db'
	store = RunsStore(db)
	store.start(RUN, 'mnist', {}, 1_000.0)
	store.close()
	reopened = RunsStore(db)
	[run] = reopened.list()
	assert run.status == 'interrupted'
	reopened.close()


def test_store_caps_points_per_fetch() -> None:
	store = RunsStore(None)
	store.start(RUN, 'big', {}, 0.0)
	store.log(RUN, 0, 0.0, {f'm{i}': float(i) for i in range(10)})
	for step in range(1, MAX_POINTS_PER_FETCH // 10 + 1):
		store.log(RUN, step, 0.0, {f'm{i}': float(i) for i in range(10)})
	page = store.metrics(RUN)
	assert len(page.points) == MAX_POINTS_PER_FETCH and page.more
	assert not store.metrics(RUN, page.cursor).more


def _client(tmp_path: Path | None = None, port: int | None = None) -> TestClient:
	return TestClient(create_app(TOKEN, data_dir=tmp_path, port=port, probe_token=PROBE))


def test_probe_stream_lifecycle_and_disconnect_interrupts() -> None:
	with _client() as client:
		with client.websocket_connect('/probe/ws', headers=PROBE_AUTH) as ws:
			ws.send_text(json.dumps([start(), log(1, loss=2.0)]))
			ws.send_text('not json')  # ignored, stream continues
			ws.send_text(
				json.dumps(
					[log(2, loss=1.0), {'type': 'finish', 'run_id': RUN, 'status': 'finished'}]
				)
			)
			ws.send_text(json.dumps([start('run-other-1234')]))
		runs = {r['id']: r for r in client.get('/runs', headers=AUTH).json()}
		assert runs[RUN]['status'] == 'finished' and runs[RUN]['last_step'] == 2
		# Connection dropped without a finish: the run can't still be streaming.
		assert runs['run-other-1234']['status'] == 'interrupted'
		detail = client.get(f'/runs/{RUN}', headers=AUTH).json()
		assert detail['config'] == {'lr': 0.001, 'model': {'layers': 2}}
		metrics = client.get(f'/runs/{RUN}/metrics', headers=AUTH).json()
		assert [(p['step'], p['value']) for p in metrics['points']] == [(1, 2.0), (2, 1.0)]
		assert client.delete(f'/runs/{RUN}', headers=AUTH).status_code == 204
		assert client.get(f'/runs/{RUN}', headers=AUTH).status_code == 404


def test_probe_reconnect_resumes_running() -> None:
	with _client() as client:
		with client.websocket_connect('/probe/ws', headers=PROBE_AUTH) as ws:
			ws.send_text(json.dumps([start()]))
		with client.websocket_connect('/probe/ws', headers=PROBE_AUTH) as ws:
			ws.send_text(json.dumps([start(), log(5, loss=0.5)]))
			# Round-trip something so the server has processed the batch before we look.
			ws.send_text('[]')
			assert client.get(f'/runs/{RUN}', headers=AUTH).json()['status'] == 'running'


def test_probe_token_only_opens_the_probe_socket() -> None:
	with _client() as client:
		assert client.get('/runs', headers=PROBE_AUTH).status_code == 401
		assert client.get('/gpu', headers=PROBE_AUTH).status_code == 401
		with pytest.raises(WebSocketDisconnect):
			with client.websocket_connect('/probe/ws') as ws:
				ws.receive_text()
		with client.websocket_connect('/probe/ws', headers=AUTH) as ws:
			ws.send_text('[]')


def test_probe_file_written_on_start_and_removed_on_shutdown(tmp_path: Path) -> None:
	path = tmp_path / 'probe.json'
	with _client(tmp_path, port=45678):
		data = json.loads(path.read_text(encoding='utf-8'))
		assert data['url'] == 'ws://127.0.0.1:45678/probe/ws' and data['token'] == PROBE
		assert (tmp_path / 'lab' / 'runs.db').exists()
	assert not path.exists()
