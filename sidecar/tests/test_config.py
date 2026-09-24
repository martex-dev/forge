import pytest

from forge_sidecar.config import ConfigError, load_settings

TOKEN = 'a' * 64


def test_loads_valid_settings() -> None:
	settings = load_settings(
		{'FORGE_TOKEN': TOKEN, 'FORGE_PORT': '51234', 'FORGE_PARENT_PID': '42'}
	)
	assert settings.port == 51234
	assert settings.token == TOKEN
	assert settings.parent_pid == 42


@pytest.mark.parametrize(
	'env',
	[
		{'FORGE_PORT': '51234'},
		{'FORGE_TOKEN': 'short', 'FORGE_PORT': '51234'},
		{'FORGE_TOKEN': TOKEN},
		{'FORGE_TOKEN': TOKEN, 'FORGE_PORT': 'abc'},
		{'FORGE_TOKEN': TOKEN, 'FORGE_PORT': '80'},
	],
)
def test_refuses_to_start_with_bad_config(env: dict[str, str]) -> None:
	with pytest.raises(ConfigError):
		load_settings(env)
