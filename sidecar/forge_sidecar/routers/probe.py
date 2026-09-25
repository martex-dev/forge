import logging
from typing import Annotated, Any, Literal

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field, TypeAdapter, ValidationError

from forge_sidecar.services.runs_store import RunsStore

router = APIRouter(tags=['probe'])
logger = logging.getLogger('forge_sidecar.probe')

RunId = Annotated[str, Field(pattern=r'^[A-Za-z0-9_-]{8,64}$')]


class StartMessage(BaseModel):
	type: Literal['start']
	run_id: RunId
	name: str = Field(min_length=1, max_length=200)
	project: str | None = Field(default=None, max_length=200)
	config: dict[str, Any] = {}
	started_at: float
	pid: int | None = None
	host: str | None = Field(default=None, max_length=200)
	script: str | None = Field(default=None, max_length=1000)


class LogMessage(BaseModel):
	type: Literal['log']
	run_id: RunId
	step: int = Field(ge=0)
	t: float
	# None = the script logged NaN/inf.
	metrics: dict[Annotated[str, Field(min_length=1, max_length=100)], float | None] = Field(
		max_length=200
	)


class FinishMessage(BaseModel):
	type: Literal['finish']
	run_id: RunId
	status: Literal['finished', 'failed']
	error: str | None = Field(default=None, max_length=4000)


ProbeMessage = Annotated[StartMessage | LogMessage | FinishMessage, Field(discriminator='type')]
# The probe batches messages: each frame is a JSON array.
Batch = TypeAdapter(list[ProbeMessage])


def apply(store: RunsStore, message: StartMessage | LogMessage | FinishMessage) -> None:
	if isinstance(message, StartMessage):
		store.start(
			message.run_id,
			message.name,
			message.config,
			message.started_at,
			project=message.project,
			pid=message.pid,
			host=message.host,
			script=message.script,
		)
	elif isinstance(message, LogMessage):
		store.log(message.run_id, message.step, message.t, message.metrics)
	else:
		store.finish(message.run_id, message.status, message.error)


@router.websocket('/probe/ws')
async def probe_ws(websocket: WebSocket) -> None:
	"""Metrics stream from forge-probe. Authenticated by the probe token (see auth.py)."""
	store: RunsStore = websocket.app.state.runs
	await websocket.accept()
	open_runs: set[str] = set()
	try:
		while True:
			raw = await websocket.receive_text()
			try:
				batch = Batch.validate_json(raw)
			except ValidationError as error:
				# One bad frame (e.g. a newer probe) shouldn't kill the run's stream.
				logger.warning('dropping invalid probe frame: %s', error.errors()[:3])
				continue
			for message in batch:
				apply(store, message)
				if isinstance(message, StartMessage):
					open_runs.add(message.run_id)
				elif isinstance(message, FinishMessage):
					open_runs.discard(message.run_id)
	except WebSocketDisconnect:
		pass
	finally:
		if open_runs:
			store.interrupt(sorted(open_runs))
