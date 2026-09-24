import platform

import pytest
from fastapi.testclient import TestClient

from forge_sidecar import __version__
from forge_sidecar.main import create_app

TOKEN = 't' * 64


@pytest.fixture
def client() -> TestClient:
	return TestClient(create_app(TOKEN))


def test_health_with_valid_token(client: TestClient) -> None:
	response = client.get('/health', headers={'Authorization': f'Bearer {TOKEN}'})
	assert response.status_code == 200
	assert response.json() == {
		'status': 'ok',
		'version': __version__,
		'python': platform.python_version(),
	}


def test_missing_token_is_rejected(client: TestClient) -> None:
	response = client.get('/health')
	assert response.status_code == 401
	assert response.headers['www-authenticate'] == 'Bearer'


@pytest.mark.parametrize(
	'header',
	[
		f'Bearer {"x" * 64}',
		f'Bearer {TOKEN}x',
		f'Bearer {TOKEN[:-1]}',
		f'Basic {TOKEN}',
		TOKEN,
		'Bearer ',
	],
)
def test_wrong_token_is_rejected(client: TestClient, header: str) -> None:
	response = client.get('/health', headers={'Authorization': header})
	assert response.status_code == 401


def test_unknown_routes_also_require_token(client: TestClient) -> None:
	assert client.get('/nope').status_code == 401


def test_docs_are_disabled(client: TestClient) -> None:
	headers = {'Authorization': f'Bearer {TOKEN}'}
	for path in ('/docs', '/redoc', '/openapi.json'):
		assert client.get(path, headers=headers).status_code == 404
