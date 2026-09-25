import json
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from forge_sidecar.main import create_app
from forge_sidecar.services.mltools import MARKER, ToolError, env_script, parse_result

TOKEN = 't' * 64
AUTH = {'Authorization': f'Bearer {TOKEN}'}
PURGED = {
	'splitter': 'purged',
	'n_samples': 40,
	'n_splits': 4,
	'horizon': 3,
	'embargo_pct': 0.05,
}


@pytest.fixture
def predictions(tmp_path: Path) -> Path:
	path = tmp_path / 'preds.csv'
	rows = ['label,prob,iso']
	for i in range(400):
		p = (i % 100) / 100
		rows.append(f'{int((i * 37) % 100 < p * 100)},{p},{min(1.0, p * 0.9)}')
	rows.append(',0.5,0.5')  # missing label: dropped, and counted
	path.write_text('\n'.join(rows) + '\n', encoding='utf-8')
	return path


def test_env_script_passes_params_as_data() -> None:
	script = env_script('run_cv', {'path': "C:/x'); import os; os.remove('y"})
	assert '_json.loads(' in script
	# The hostile string only ever appears inside a JSON string literal.
	compile(script, '<test>', 'exec')
	assert parse_result(f'noise\n{MARKER}{json.dumps({"ok": 1})}\n') == {'ok': 1}
	with pytest.raises(ToolError):
		parse_result('no marker here')


def test_bundled_cv_and_calibration(predictions: Path) -> None:
	with TestClient(create_app(token=TOKEN)) as client:
		purged = client.post('/mltools/cv', json=PURGED, headers=AUTH).json()
		assert purged['detailed'] is True and len(purged['folds']) == 4
		categories = {seg[0] for fold in purged['folds'] for seg in fold}
		assert {2, 3} <= categories  # purged-cv reported purge and embargo
		kfold = client.post(
			'/mltools/cv', json={'splitter': 'kfold', 'n_samples': 20, 'n_splits': 5}, headers=AUTH
		).json()
		assert kfold['detailed'] is False
		cal = client.post(
			'/mltools/calibration',
			json={
				'path': str(predictions),
				'y_true': 'label',
				'y_prob': 'prob',
				'variants': ['iso'],
			},
			headers=AUTH,
		).json()
		assert list(cal['reports']) == ['model', 'iso']
		assert cal['reports']['model']['n_samples'] == 400
		assert cal['dropped_rows'] == 1
		cols = client.post('/mltools/columns', json={'path': str(predictions)}, headers=AUTH)
		assert cols.json() == ['label', 'prob', 'iso']
		bad = client.post(
			'/mltools/calibration',
			json={'path': str(predictions), 'y_true': 'nope', 'y_prob': 'prob'},
			headers=AUTH,
		)
		assert bad.status_code == 400


def test_env_engine_matches_bundled(predictions: Path) -> None:
	# The sidecar's own interpreter stands in for "your environment" (it has the libraries).
	engine = {'kind': 'env', 'python': sys.executable}
	with TestClient(create_app(token=TOKEN)) as client:
		bundled = client.post('/mltools/cv', json=PURGED, headers=AUTH).json()
		res = client.post('/mltools/cv', json={**PURGED, 'engine': engine}, headers=AUTH)
		assert res.status_code == 200, res.text
		assert res.json() == bundled
		# A second call reuses the warm kernel.
		again = client.post('/mltools/cv', json={**PURGED, 'engine': engine}, headers=AUTH)
		assert again.json() == bundled
		broken = client.post(
			'/mltools/calibration',
			json={
				'path': str(predictions),
				'y_true': 'label',
				'y_prob': 'missing',
				'engine': engine,
			},
			headers=AUTH,
		)
		assert broken.status_code == 400
		assert 'missing' in broken.json()['detail'] or 'ColumnNotFound' in broken.json()['detail']
