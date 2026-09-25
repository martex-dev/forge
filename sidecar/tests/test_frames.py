from pathlib import Path

import polars as pl
import pytest
from fastapi.testclient import TestClient

from forge_sidecar.main import create_app
from forge_sidecar.services.frame_sql import to_json_value

TOKEN = 't' * 64
AUTH = {'Authorization': f'Bearer {TOKEN}'}


@pytest.fixture
def files(tmp_path: Path) -> dict[str, Path]:
	csv = tmp_path / 'runs.csv'
	lines = ['epoch,loss,split,note']
	lines += [f'{i},{1 / (i + 1):.4f},{"val" if i % 4 == 0 else "train"},n{i}' for i in range(100)]
	csv.write_text('\n'.join(lines) + '\n', encoding='utf-8')
	parquet = tmp_path / 'runs.parquet'
	pl.read_csv(csv).write_parquet(parquet)
	feather = tmp_path / 'small.feather'
	pl.DataFrame({'x': [1.0, float('nan'), 3.0], 'y': ['a', 'b', None]}).write_ipc(feather)
	return {'csv': csv, 'parquet': parquet, 'feather': feather}


@pytest.fixture
def client(tmp_path: Path) -> TestClient:
	return TestClient(create_app(token=TOKEN, data_dir=tmp_path / 'data'))


def _open(client: TestClient, path: Path) -> dict:
	res = client.post('/frames/open', json={'path': str(path)}, headers=AUTH)
	assert res.status_code == 200, res.text
	return res.json()


def _rows(client: TestClient, frame_id: str, **body: object) -> dict:
	res = client.post(
		f'/frames/{frame_id}/rows', json={'offset': 0, 'limit': 5, **body}, headers=AUTH
	)
	assert res.status_code == 200, res.text
	return res.json()


def test_open_each_format(client: TestClient, files: dict[str, Path]) -> None:
	with client:
		csv = _open(client, files['csv'])
		assert csv['format'] == 'csv'
		assert csv['row_count'] == 100
		assert [c['name'] for c in csv['columns']] == ['epoch', 'loss', 'split', 'note']
		assert _open(client, files['parquet'])['row_count'] == 100
		feather = _open(client, files['feather'])
		assert feather['format'] == 'arrow'
		page = _rows(client, feather['id'])
		# NaN stays visible as text; SQL NULL is null.
		assert page['rows'] == [[1.0, 'a'], ['nan', 'b'], [3.0, None]]


def test_paging_sort_where_and_sql(client: TestClient, files: dict[str, Path]) -> None:
	with client:
		frame = _open(client, files['parquet'])['id']
		page = _rows(client, frame, offset=10, limit=3)
		assert [r[0] for r in page['rows']] == [10, 11, 12]
		assert page['total'] == 100
		page = _rows(client, frame, sort=[{'column': 'loss', 'desc': True}], limit=2)
		assert [r[0] for r in page['rows']] == [0, 1]
		page = _rows(client, frame, where="split = 'val' AND epoch >= 50")
		assert page['total'] == 12
		page = _rows(client, frame, sql='SELECT split, count(*) AS n FROM t GROUP BY split')
		assert sorted(page['rows']) == [['train', 75], ['val', 25]]
		assert [c['name'] for c in page['columns']] == ['split', 'n']


@pytest.mark.parametrize(
	'sql',
	[
		"COPY (SELECT 1) TO 'out.csv'",
		"ATTACH 'x.db'",
		'SELECT 1; SELECT 2',
		'SET threads = 1',
		'INSTALL httpfs',
		'SELECT 1) AS q; DROP VIEW t; SELECT * FROM (SELECT 1',
	],
)
def test_only_single_select_runs(client: TestClient, files: dict[str, Path], sql: str) -> None:
	with client:
		frame = _open(client, files['csv'])['id']
		res = client.post(
			f'/frames/{frame}/rows', json={'offset': 0, 'limit': 5, 'sql': sql}, headers=AUTH
		)
		assert res.status_code == 400
		if sql.startswith(('COPY', 'ATTACH', 'SET', 'INSTALL')):
			assert 'Only SELECT' in res.json()['detail']
		# The view is still there.
		assert _rows(client, frame)['total'] == 100


def test_where_cannot_smuggle_statements(client: TestClient, files: dict[str, Path]) -> None:
	with client:
		frame = _open(client, files['csv'])['id']
		res = client.post(
			f'/frames/{frame}/rows',
			json={'offset': 0, 'limit': 5, 'where': "true); COPY t TO 'x.csv'; SELECT (1"},
			headers=AUTH,
		)
		assert res.status_code == 400


def test_sql_errors_are_reported(client: TestClient, files: dict[str, Path]) -> None:
	with client:
		frame = _open(client, files['csv'])['id']
		res = client.post(
			f'/frames/{frame}/rows',
			json={'offset': 0, 'limit': 5, 'sql': 'SELECT nope FROM t'},
			headers=AUTH,
		)
		assert res.status_code == 400
		assert 'nope' in res.json()['detail']


def test_summary_and_histograms(client: TestClient, files: dict[str, Path]) -> None:
	with client:
		frame = _open(client, files['csv'])['id']
		res = client.get(f'/frames/{frame}/summary', headers=AUTH)
		stats = {row['column_name']: row for row in res.json()}
		assert stats['epoch']['max'] == '99'
		numeric = client.post(
			f'/frames/{frame}/histogram', json={'column': 'epoch', 'bins': 10}, headers=AUTH
		).json()
		assert numeric['kind'] == 'numeric'
		assert numeric['counts'] == [10] * 10
		assert numeric['edges'][0] == 0 and numeric['edges'][-1] == 99
		cat = client.post(
			f'/frames/{frame}/histogram', json={'column': 'split'}, headers=AUTH
		).json()
		assert (cat['labels'], cat['counts']) == (['train', 'val'], [75, 25])


def test_unknown_and_reopened_frames(client: TestClient, files: dict[str, Path]) -> None:
	with client:
		first = _open(client, files['csv'])['id']
		second = _open(client, files['csv'])['id']
		assert first != second
		res = client.post(f'/frames/{first}/rows', json={'offset': 0, 'limit': 1}, headers=AUTH)
		assert (res.status_code, res.json()['detail']) == (404, 'FRAME_NOT_FOUND')
		bad = client.post('/frames/open', json={'path': 'relative.csv'}, headers=AUTH)
		assert bad.status_code == 400
		missing = client.post('/frames/open', json={'path': str(files['csv']) + 'x'}, headers=AUTH)
		assert missing.status_code == 400  # unknown extension
		assert client.delete(f'/frames/{second}', headers=AUTH).status_code == 204


def test_json_values() -> None:
	assert to_json_value(float('inf')) == 'inf'
	assert to_json_value(b'abc') == '<3 bytes>'
	assert to_json_value({'a': [1, float('nan')]}) == {'a': [1, 'nan']}
	assert to_json_value('x' * 3000).endswith('…')
