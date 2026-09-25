"""Jupyter message → nbformat output conversion and kernel-spec helpers for notebooks.py."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from jupyter_client.kernelspec import KernelSpec, KernelSpecManager

ExecStatus = Literal['queued', 'running', 'done', 'error', 'aborted']
KEEP_MIME = (
	'text/plain',
	'text/markdown',
	'text/html',
	'image/png',
	'image/jpeg',
	'image/svg+xml',
	'application/json',
)
MAX_OUTPUT_BYTES = 8_000_000


@dataclass
class Execution:
	id: str
	status: ExecStatus = 'queued'
	execution_count: int | None = None
	outputs: list[dict[str, Any]] = field(default_factory=list)
	size: int = 0
	truncated: bool = False


class OneSpec(KernelSpecManager):
	"""Serves a single spec built from an interpreter path (no kernelspec registration needed)."""

	def __init__(self, spec: KernelSpec) -> None:
		super().__init__()
		self._spec = spec

	def get_kernel_spec(self, kernel_name: str) -> KernelSpec:
		return self._spec


def normalize_output(msg_type: str, content: dict[str, Any]) -> dict[str, Any] | None:
	"""iopub message → nbformat v4 output (what ends up in the .ipynb)."""
	if msg_type == 'stream':
		return {
			'output_type': 'stream',
			'name': content.get('name', 'stdout'),
			'text': content.get('text', ''),
		}
	if msg_type in ('execute_result', 'display_data', 'update_display_data'):
		data = {k: v for k, v in (content.get('data') or {}).items() if k in KEEP_MIME}
		out: dict[str, Any] = {
			'output_type': 'execute_result' if msg_type == 'execute_result' else 'display_data',
			'data': data,
			'metadata': content.get('metadata') or {},
		}
		if msg_type == 'execute_result':
			out['execution_count'] = content.get('execution_count')
		return out
	if msg_type == 'error':
		return {
			'output_type': 'error',
			'ename': content.get('ename', ''),
			'evalue': content.get('evalue', ''),
			'traceback': content.get('traceback') or [],
		}
	if msg_type == 'clear_output':
		# Not an nbformat output: the panel applies it and it's never saved.
		return {'output_type': 'clear_output', 'wait': bool(content.get('wait'))}
	return None


def env_label(python: Path) -> str:
	"""'C:/proj/.venv/Scripts/python.exe' → 'proj (.venv)': the environment, not the binary."""
	env = (
		python.parent.parent if python.parent.name.lower() in ('scripts', 'bin') else python.parent
	)
	if env.name.lower() in ('.venv', 'venv', 'env', '.env'):
		return f'{env.parent.name} ({env.name})'
	return env.name or str(python)
