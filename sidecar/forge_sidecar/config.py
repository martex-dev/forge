import os
from dataclasses import dataclass
from pathlib import Path


class ConfigError(RuntimeError):
	pass


@dataclass(frozen=True)
class Settings:
	port: int
	token: str
	parent_pid: int | None
	# Where caches live (Forge's userData/sidecar); None disables persistence.
	data_dir: Path | None = None


def load_settings(env: dict[str, str] | None = None) -> Settings:
	"""Reads launch parameters that Forge main passes via environment variables."""
	source = os.environ if env is None else env
	token = source.get('FORGE_TOKEN', '')
	if len(token) < 32:
		raise ConfigError(
			'FORGE_TOKEN must be set (at least 32 chars); refusing to start unauthenticated'
		)
	try:
		port = int(source.get('FORGE_PORT', ''))
	except ValueError as error:
		raise ConfigError('FORGE_PORT must be an integer') from error
	if not 1024 <= port <= 65535:
		raise ConfigError('FORGE_PORT must be between 1024 and 65535')
	parent = source.get('FORGE_PARENT_PID')
	data_dir = source.get('FORGE_DATA_DIR')
	return Settings(
		port=port,
		token=token,
		parent_pid=int(parent) if parent else None,
		data_dir=Path(data_dir) if data_dir else None,
	)
