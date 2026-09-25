import json
import os
import sys
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class Endpoint:
	url: str
	token: str


def discovery_file() -> Path:
	"""
	Where a running Forge sidecar advertises its probe endpoint: Forge's userData folder, or
	FORGE_PROBE_FILE if set (tests, portable installs).
	"""
	override = os.environ.get('FORGE_PROBE_FILE')
	if override:
		return Path(override)
	if sys.platform == 'win32':
		base = Path(os.environ.get('APPDATA') or Path.home() / 'AppData' / 'Roaming')
	elif sys.platform == 'darwin':
		base = Path.home() / 'Library' / 'Application Support'
	else:
		base = Path(os.environ.get('XDG_CONFIG_HOME') or Path.home() / '.config')
	return base / 'Forge' / 'sidecar' / 'probe.json'


def read_endpoint(path: Path | None = None) -> Endpoint | None:
	"""None when Forge isn't running (no file) or the file is unreadable."""
	try:
		data = json.loads((path or discovery_file()).read_text(encoding='utf-8'))
	except (OSError, ValueError):
		return None
	url, token = data.get('url'), data.get('token')
	# Only ever talk to a sidecar on this machine.
	if not isinstance(url, str) or not url.startswith('ws://127.0.0.1:'):
		return None
	if not isinstance(token, str) or not token:
		return None
	return Endpoint(url=url, token=token)
