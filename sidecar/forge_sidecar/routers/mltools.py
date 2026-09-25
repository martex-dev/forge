import asyncio
from typing import Annotated, Any, Literal

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from forge_sidecar.services.mltools import MlTools, ToolError, file_columns

router = APIRouter(prefix='/mltools', tags=['mltools'])


class Bundled(BaseModel):
	kind: Literal['bundled'] = 'bundled'


class EnvEngine(BaseModel):
	kind: Literal['env']
	spec: str | None = Field(default=None, max_length=200)
	python: str | None = Field(default=None, max_length=1024)


Engine = Annotated[Bundled | EnvEngine, Field(discriminator='kind')]


class CvRequest(BaseModel):
	splitter: Literal['kfold', 'timeseries', 'purged']
	n_samples: int = Field(ge=10, le=100_000)
	n_splits: int = Field(ge=2, le=20)
	shuffle: bool = False
	seed: int = 0
	gap: int = Field(default=0, ge=0, le=10_000)
	horizon: int = Field(default=0, ge=0, le=10_000)
	embargo_pct: float = Field(default=0.0, ge=0.0, lt=0.5)
	engine: Engine = Field(default_factory=Bundled)


class CalibrationRequest(BaseModel):
	path: str = Field(min_length=3, max_length=1024)
	y_true: str = Field(min_length=1, max_length=200)
	y_prob: str = Field(min_length=1, max_length=200)
	variants: list[Annotated[str, Field(min_length=1, max_length=200)]] = Field(
		default_factory=list, max_length=4
	)
	n_bins: int = Field(default=10, ge=2, le=50)
	engine: Engine = Field(default_factory=Bundled)


async def _run(
	request: Request, job: str, body: 'CvRequest | CalibrationRequest'
) -> dict[str, Any]:
	tools: MlTools = request.app.state.mltools
	params = body.model_dump(exclude={'engine'})
	engine = body.engine.model_dump()
	try:
		return await tools.run(job, params, engine)
	except ToolError as error:
		raise HTTPException(status_code=400, detail=str(error)) from error


class ColumnsRequest(BaseModel):
	path: str = Field(min_length=3, max_length=1024)


@router.post('/columns')
async def columns(body: ColumnsRequest) -> list[str]:
	"""Column names for the calibration pickers, read from the schema only."""
	try:
		return await asyncio.to_thread(file_columns, body.path)
	except Exception as error:
		raise HTTPException(status_code=400, detail=f'{type(error).__name__}: {error}') from error


@router.post('/cv')
async def cv(request: Request, body: CvRequest) -> dict[str, Any]:
	return await _run(request, 'run_cv', body)


@router.post('/calibration')
async def calibration(request: Request, body: CalibrationRequest) -> dict[str, Any]:
	return await _run(request, 'run_calibration', body)
