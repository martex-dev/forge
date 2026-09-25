"""
Notebook kernels. The sidecar starts Jupyter kernels from Marto's own environments (registered
kernelspecs, or any interpreter with ipykernel) and keeps each execution's outputs so the panel
can poll them; the notebook file itself is read and written by main.
"""

import asyncio
import contextlib
import logging
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

from jupyter_client.kernelspec import KernelSpec, KernelSpecManager
from jupyter_client.manager import AsyncKernelManager

from forge_sidecar.services.notebook_protocol import (
	MAX_OUTPUT_BYTES,
	Execution,
	OneSpec,
	env_label,
	normalize_output,
)

logger = logging.getLogger('forge_sidecar.notebooks')

MAX_SESSIONS = 8
IOPUB_TIMEOUT = 30.0


class SessionError(RuntimeError):
	pass


@dataclass
class Session:
	id: str
	label: str
	km: AsyncKernelManager
	client: Any
	executions: dict[str, Execution] = field(default_factory=dict)
	state: Literal['starting', 'idle', 'busy', 'dead'] = 'starting'
	reader: asyncio.Task[None] | None = None
	shell: asyncio.Task[None] | None = None
	# kernel_info probes in flight, and set once iopub has echoed one (see _await_iopub).
	probes: set[str] = field(default_factory=set)
	iopub_live: asyncio.Event = field(default_factory=asyncio.Event)


class NotebookService:
	def __init__(self) -> None:
		self.sessions: dict[str, Session] = {}
		self._tasks: set[asyncio.Task[None]] = set()

	def kernelspecs(self) -> list[dict[str, str]]:
		specs = KernelSpecManager().get_all_specs()
		return sorted(
			(
				{
					'name': name,
					'display_name': s['spec'].get('display_name', name),
					'language': s['spec'].get('language', ''),
				}
				for name, s in specs.items()
			),
			key=lambda s: s['display_name'].lower(),
		)

	async def start(self, spec: str | None, python: str | None, cwd: str) -> Session:
		if len(self.sessions) >= MAX_SESSIONS:
			raise SessionError(f'At most {MAX_SESSIONS} kernels at once; close a notebook first')
		if not await asyncio.to_thread(Path(cwd).is_dir):
			raise SessionError(f'{cwd} is not a folder')
		if python:
			exe = Path(python)
			if not await asyncio.to_thread(exe.is_file):
				raise SessionError(f'{python} does not exist')
			kspec = KernelSpec(
				argv=[str(exe), '-m', 'ipykernel_launcher', '-f', '{connection_file}'],
				display_name=env_label(exe),
				language='python',
			)
			km = AsyncKernelManager(kernel_name='forge-python', kernel_spec_manager=OneSpec(kspec))
			label = env_label(exe)
		elif spec:
			km = AsyncKernelManager(kernel_name=spec)
			label = spec
		else:
			raise SessionError('Pick a kernel')
		try:
			await km.start_kernel(cwd=cwd)
		except Exception as error:
			raise SessionError(
				f'The kernel did not start: {error}. Is ipykernel installed in that environment?'
			) from error
		client = km.client()
		client.start_channels()
		try:
			await client.wait_for_ready(timeout=60)
		except RuntimeError as error:
			client.stop_channels()
			await km.shutdown_kernel(now=True)
			raise SessionError(f'The kernel did not become ready: {error}') from error
		session = Session(id=uuid.uuid4().hex, label=label, km=km, client=client, state='idle')
		session.reader = asyncio.create_task(self._read_iopub(session))
		session.shell = asyncio.create_task(self._read_shell(session))
		self.sessions[session.id] = session
		try:
			await self._await_iopub(session)
		except SessionError:
			await self.shutdown(session.id)
			raise
		return session

	def get(self, session_id: str) -> Session:
		session = self.sessions.get(session_id)
		if session is None:
			raise KeyError(session_id)
		return session

	async def _await_iopub(self, session: Session) -> None:
		"""
		ZMQ's slow joiner: iopub can connect after the kernel is ready, and anything published
		before that (a fast cell's result) is lost. Probe with kernel_info until iopub echoes one.
		"""
		session.iopub_live.clear()
		deadline = asyncio.get_running_loop().time() + IOPUB_TIMEOUT
		while not session.iopub_live.is_set():
			if asyncio.get_running_loop().time() > deadline:
				raise SessionError('The kernel started but its output channel never connected')
			session.probes.add(session.client.kernel_info())
			with contextlib.suppress(TimeoutError):
				await asyncio.wait_for(session.iopub_live.wait(), 0.25)
		session.probes.clear()

	def execute(self, session_id: str, code: str) -> Execution:
		session = self.get(session_id)
		if session.state == 'dead':
			raise SessionError('The kernel died; restart it')
		# stop_on_error=False: a failing cell mustn't silently abort the ones queued after it.
		msg_id = session.client.execute(code, allow_stdin=False, stop_on_error=False)
		execution = Execution(id=msg_id)
		session.executions[msg_id] = execution
		# Keep memory bounded on long sessions: forget old finished executions.
		if len(session.executions) > 500:
			for key in [k for k, e in session.executions.items() if e.status != 'running'][:250]:
				session.executions.pop(key, None)
		return execution

	def _record(self, execution: Execution, output: dict[str, Any]) -> None:
		if execution.truncated:
			return
		size = len(str(output))
		if execution.size + size > MAX_OUTPUT_BYTES:
			execution.truncated = True
			output = {
				'output_type': 'stream',
				'name': 'stderr',
				'text': '\n[Forge: output truncated at 8 MB]\n',
			}
		execution.size += size
		execution.outputs.append(output)

	async def _read_iopub(self, session: Session) -> None:
		while True:
			try:
				msg = await session.client.get_iopub_msg()
			except asyncio.CancelledError:
				raise
			except Exception as error:
				# A restart briefly drops the channel; only a kernel that's really gone ends this.
				if await session.km.is_alive():
					await asyncio.sleep(0.1)
					continue
				logger.warning('iopub for %s ended: %s', session.label, error)
				session.state = 'dead'
				return
			msg_type = msg['header']['msg_type']
			content = msg.get('content') or {}
			parent = (msg.get('parent_header') or {}).get('msg_id')
			if msg_type == 'status' and parent in session.probes:
				session.iopub_live.set()
			if msg_type == 'status':
				state = content.get('execution_state')
				if state in ('busy', 'idle'):
					session.state = state
				execution = session.executions.get(parent) if parent else None
				if execution and state == 'busy' and execution.status == 'queued':
					execution.status = 'running'
				elif execution and state == 'idle' and execution.status in ('queued', 'running'):
					has_error = any(o['output_type'] == 'error' for o in execution.outputs)
					execution.status = 'error' if has_error else 'done'
				continue
			execution = session.executions.get(parent) if parent else None
			if execution is None:
				continue
			if msg_type == 'execute_input':
				execution.execution_count = content.get('execution_count')
				continue
			output = normalize_output(msg_type, content)
			if output is not None:
				self._record(execution, output)

	async def _read_shell(self, session: Session) -> None:
		while True:
			try:
				msg = await session.client.get_shell_msg()
			except asyncio.CancelledError:
				raise
			except Exception:  # closed with the kernel; iopub reports the death
				return
			parent = (msg.get('parent_header') or {}).get('msg_id')
			execution = session.executions.get(parent) if parent else None
			if execution is None:
				continue
			content = msg.get('content') or {}
			if execution.execution_count is None:
				execution.execution_count = content.get('execution_count')
			if content.get('status') == 'aborted':
				execution.status = 'aborted'
			else:
				task = asyncio.create_task(self._settle(execution, content))
				# Held until done: the event loop only keeps weak references to tasks.
				self._tasks.add(task)
				task.add_done_callback(self._tasks.discard)

	@staticmethod
	async def _settle(execution: Execution, reply: dict[str, Any]) -> None:
		"""
		The execute_reply as a backstop for iopub: right after a (re)start the iopub subscription
		can miss a fast cell's busy/idle (ZMQ slow joiner), which would leave it running forever.
		The grace period lets trailing iopub output land first.
		"""
		await asyncio.sleep(0.5)
		if execution.status not in ('queued', 'running'):
			return
		if reply.get('status') == 'error':
			if not any(o['output_type'] == 'error' for o in execution.outputs):
				execution.outputs.append(
					{
						'output_type': 'error',
						'ename': reply.get('ename', ''),
						'evalue': reply.get('evalue', ''),
						'traceback': reply.get('traceback') or [],
					}
				)
			execution.status = 'error'
		else:
			execution.status = 'done'

	def poll(self, session_id: str, exec_id: str, after: int) -> dict[str, Any]:
		session = self.get(session_id)
		execution = session.executions.get(exec_id)
		if execution is None:
			raise KeyError(exec_id)
		if session.state == 'dead' and execution.status in ('queued', 'running'):
			execution.status = 'aborted'
		return {
			'status': execution.status,
			'execution_count': execution.execution_count,
			'outputs': execution.outputs[after:],
			'next': len(execution.outputs),
			'kernel_state': session.state,
		}

	async def interrupt(self, session_id: str) -> None:
		await self.get(session_id).km.interrupt_kernel()

	async def restart(self, session_id: str) -> None:
		session = self.get(session_id)
		for execution in session.executions.values():
			if execution.status in ('queued', 'running'):
				execution.status = 'aborted'
		session.state = 'starting'
		await session.km.restart_kernel(now=True)
		# No wait_for_ready here: it would race the shell reader for the kernel_info reply. An
		# execute sent now simply queues until the new kernel is up.
		# The readers may have ended while the kernel was down: make sure they run again.
		if session.reader is None or session.reader.done():
			session.reader = asyncio.create_task(self._read_iopub(session))
		if session.shell is None or session.shell.done():
			session.shell = asyncio.create_task(self._read_shell(session))
		await self._await_iopub(session)
		session.state = 'idle'

	async def shutdown(self, session_id: str) -> None:
		session = self.sessions.pop(session_id, None)
		if session is None:
			return
		for task in (session.reader, session.shell):
			if task:
				task.cancel()
		session.client.stop_channels()
		with contextlib.suppress(Exception):  # already dead is fine: that's the goal
			await session.km.shutdown_kernel(now=True)

	async def shutdown_all(self) -> None:
		await asyncio.gather(*(self.shutdown(sid) for sid in list(self.sessions)))
