import sys
import time
from pathlib import Path
from typing import Any

from fastapi.testclient import TestClient

from forge_sidecar.main import create_app
from forge_sidecar.services.notebook_protocol import env_label, normalize_output

TOKEN = 't' * 64
AUTH = {'Authorization': f'Bearer {TOKEN}'}


def _wait(client: TestClient, sid: str, eid: str, timeout: float = 30) -> dict[str, Any]:
	outputs: list[dict[str, Any]] = []
	after = 0
	deadline = time.monotonic() + timeout
	while time.monotonic() < deadline:
		res = client.get(f'/nb/sessions/{sid}/executions/{eid}?after={after}', headers=AUTH).json()
		outputs += res['outputs']
		after = res['next']
		if res['status'] in ('done', 'error', 'aborted'):
			return {**res, 'outputs': outputs}
		time.sleep(0.05)
	raise AssertionError('execution did not finish')


def _run(client: TestClient, sid: str, code: str) -> dict[str, Any]:
	res = client.post(f'/nb/sessions/{sid}/execute', json={'code': code}, headers=AUTH)
	assert res.status_code == 200, res.text
	return _wait(client, sid, res.json()['id'])


def test_normalize_keeps_nbformat_shapes() -> None:
	assert normalize_output('stream', {'name': 'stdout', 'text': 'hi'}) == {
		'output_type': 'stream',
		'name': 'stdout',
		'text': 'hi',
	}
	out = normalize_output(
		'execute_result',
		{'data': {'text/plain': '2', 'application/x-weird': 'x'}, 'execution_count': 3},
	)
	assert out == {
		'output_type': 'execute_result',
		'data': {'text/plain': '2'},
		'metadata': {},
		'execution_count': 3,
	}
	assert normalize_output('comm_open', {}) is None


def test_env_label_names_the_environment() -> None:
	assert env_label(Path('C:/work/proj/.venv/Scripts/python.exe')) == 'proj (.venv)'
	assert env_label(Path('/home/m/miniconda3/envs/torch/bin/python')) == 'torch'
	assert env_label(Path('C:/Python312/python.exe')) == 'Python312'


def test_kernel_session_end_to_end(tmp_path: Path) -> None:
	with TestClient(create_app(token=TOKEN)) as client:
		specs = client.get('/nb/kernelspecs', headers=AUTH).json()
		assert isinstance(specs, list)
		res = client.post(
			'/nb/sessions', json={'python': sys.executable, 'cwd': str(tmp_path)}, headers=AUTH
		)
		assert res.status_code == 200, res.text
		sid = res.json()['id']

		ok = _run(client, sid, "import os\nprint('cwd', os.getcwd())\n21 * 2")
		assert ok['status'] == 'done' and ok['execution_count'] == 1
		assert ok['outputs'][0]['text'].strip().endswith(tmp_path.name)
		assert ok['outputs'][-1]['data']['text/plain'] == '42'

		# State persists between cells; errors don't stop later cells.
		err = _run(client, sid, 'x = 5\n1 / 0')
		assert err['status'] == 'error'
		assert err['outputs'][-1]['ename'] == 'ZeroDivisionError'
		assert _run(client, sid, 'x + 1')['outputs'][-1]['data']['text/plain'] == '6'

		# No stdin in the panel: input() fails fast instead of hanging.
		assert _run(client, sid, "input('?')")['status'] == 'error'

		# Interrupt a long cell. (A busy loop: on Windows, blocking C calls like time.sleep only
		# notice the interrupt when they return. Restart is the escape hatch there.)
		eid = client.post(
			f'/nb/sessions/{sid}/execute',
			json={'code': 'i = 0\nwhile True:\n    i += 1'},
			headers=AUTH,
		).json()['id']
		time.sleep(1.0)
		assert client.post(f'/nb/sessions/{sid}/interrupt', headers=AUTH).status_code == 204
		interrupted = _wait(client, sid, eid, timeout=15)
		assert interrupted['outputs'][-1]['ename'] == 'KeyboardInterrupt'

		# Restart clears state.
		assert client.post(f'/nb/sessions/{sid}/restart', headers=AUTH).status_code == 204
		assert _run(client, sid, "'x' in dir()")['outputs'][-1]['data']['text/plain'] == 'False'

		assert client.delete(f'/nb/sessions/{sid}', headers=AUTH).status_code == 204
		gone = client.post(f'/nb/sessions/{sid}/execute', json={'code': '1'}, headers=AUTH)
		assert (gone.status_code, gone.json()['detail']) == (404, 'SESSION_NOT_FOUND')


def test_bad_kernel_requests(tmp_path: Path) -> None:
	with TestClient(create_app(token=TOKEN)) as client:
		missing = client.post(
			'/nb/sessions',
			json={'python': str(tmp_path / 'nope.exe'), 'cwd': str(tmp_path)},
			headers=AUTH,
		)
		assert missing.status_code == 400
		no_dir = client.post(
			'/nb/sessions',
			json={'python': sys.executable, 'cwd': str(tmp_path / 'x')},
			headers=AUTH,
		)
		assert no_dir.status_code == 400
		assert (
			client.post('/nb/sessions', json={'cwd': str(tmp_path)}, headers=AUTH).status_code
			== 400
		)
