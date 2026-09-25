from fastapi import APIRouter, HTTPException, Path, Query, Request
from pydantic import BaseModel, Field

from forge_sidecar.services.runs_store import (
	MetricsPage,
	Run,
	RunDetail,
	RunsStore,
	RunSummary,
)

router = APIRouter(prefix='/runs', tags=['runs'])

RunIdPath = Path(pattern=r'^[A-Za-z0-9_-]{8,64}$')


def _store(request: Request) -> RunsStore:
	return request.app.state.runs


@router.get('', response_model=list[Run])
async def list_runs(request: Request) -> list[Run]:
	return _store(request).list()


class SummaryRequest(BaseModel):
	ids: list[str] = Field(min_length=1, max_length=12)


class Series(BaseModel):
	series: dict[str, list[tuple[int, float | None]]]


# Declared before /{run_id} so 'summary' isn't taken for a run id.
@router.post('/summary', response_model=list[RunSummary])
async def summary(request: Request, body: SummaryRequest) -> list[RunSummary]:
	return _store(request).summary(body.ids)


@router.get('/{run_id}/series', response_model=Series)
async def series(
	request: Request,
	run_id: str = RunIdPath,
	max_points: int = Query(default=1500, ge=50, le=10000),
) -> Series:
	return Series(series=_store(request).series(run_id, max_points))


@router.get('/{run_id}', response_model=RunDetail)
async def get_run(request: Request, run_id: str = RunIdPath) -> RunDetail:
	run = _store(request).get(run_id)
	if run is None:
		raise HTTPException(status_code=404, detail='Run not found')
	return run


@router.get('/{run_id}/metrics', response_model=MetricsPage)
async def run_metrics(
	request: Request, run_id: str = RunIdPath, after: int = Query(default=0, ge=0)
) -> MetricsPage:
	return _store(request).metrics(run_id, after)


@router.delete('/{run_id}', status_code=204)
async def delete_run(request: Request, run_id: str = RunIdPath) -> None:
	if not _store(request).delete(run_id):
		raise HTTPException(status_code=404, detail='Run not found')
