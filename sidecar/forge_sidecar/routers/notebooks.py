from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from forge_sidecar.services.notebooks import NotebookService, SessionError

router = APIRouter(prefix='/nb', tags=['notebooks'])


class StartRequest(BaseModel):
	spec: str | None = Field(default=None, max_length=200)
	python: str | None = Field(default=None, max_length=1024)
	cwd: str = Field(min_length=1, max_length=1024)


class ExecuteRequest(BaseModel):
	code: str = Field(max_length=1_000_000)


def _svc(request: Request) -> NotebookService:
	return request.app.state.notebooks


def _missing(what: str) -> HTTPException:
	# Main maps this code to "the kernel is gone" (e.g. after a sidecar restart).
	return HTTPException(status_code=404, detail=f'{what}_NOT_FOUND')


@router.get('/kernelspecs')
async def kernelspecs(request: Request) -> list[dict[str, str]]:
	return _svc(request).kernelspecs()


@router.post('/sessions')
async def start(request: Request, body: StartRequest) -> dict[str, str]:
	try:
		session = await _svc(request).start(body.spec, body.python, body.cwd)
	except SessionError as error:
		raise HTTPException(status_code=400, detail=str(error)) from error
	return {'id': session.id, 'label': session.label}


@router.post('/sessions/{session_id}/execute')
async def execute(request: Request, session_id: str, body: ExecuteRequest) -> dict[str, str]:
	try:
		return {'id': _svc(request).execute(session_id, body.code).id}
	except KeyError as error:
		raise _missing('SESSION') from error
	except SessionError as error:
		raise HTTPException(status_code=409, detail=str(error)) from error


@router.get('/sessions/{session_id}/executions/{exec_id}')
async def poll(request: Request, session_id: str, exec_id: str, after: int = 0) -> dict[str, Any]:
	try:
		return _svc(request).poll(session_id, exec_id, max(0, after))
	except KeyError as error:
		raise _missing('EXECUTION') from error


@router.post('/sessions/{session_id}/interrupt', status_code=204)
async def interrupt(request: Request, session_id: str) -> None:
	try:
		await _svc(request).interrupt(session_id)
	except KeyError as error:
		raise _missing('SESSION') from error


@router.post('/sessions/{session_id}/restart', status_code=204)
async def restart(request: Request, session_id: str) -> None:
	try:
		await _svc(request).restart(session_id)
	except KeyError as error:
		raise _missing('SESSION') from error


@router.delete('/sessions/{session_id}', status_code=204)
async def shutdown(request: Request, session_id: str) -> None:
	await _svc(request).shutdown(session_id)
