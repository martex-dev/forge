from typing import Any

import duckdb
import polars as pl
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from forge_sidecar.services.frame_sql import QueryRejected
from forge_sidecar.services.frames import FrameInfo, FrameNotFound, FrameStore, Page

router = APIRouter(prefix='/frames', tags=['frames'])


class OpenRequest(BaseModel):
	path: str = Field(min_length=3, max_length=1024)


class SortKey(BaseModel):
	column: str = Field(max_length=512)
	desc: bool = False


class RowsRequest(BaseModel):
	offset: int = Field(ge=0)
	limit: int = Field(ge=1, le=1000)
	sort: list[SortKey] = Field(default_factory=list, max_length=8)
	where: str | None = Field(default=None, max_length=4000)
	sql: str | None = Field(default=None, max_length=20000)


class HistogramRequest(BaseModel):
	column: str = Field(max_length=512)
	bins: int = Field(default=30, ge=2, le=200)


def _store(request: Request) -> FrameStore:
	return request.app.state.frames


def _fail(error: Exception) -> HTTPException:
	if isinstance(error, FrameNotFound):
		# Main re-opens by path on this code (e.g. after a sidecar restart).
		return HTTPException(status_code=404, detail='FRAME_NOT_FOUND')
	if isinstance(error, FileNotFoundError):
		return HTTPException(status_code=404, detail=str(error))
	# DuckDB's messages (syntax errors, unknown columns) are what Marto needs to fix a query.
	if isinstance(error, QueryRejected | ValueError | duckdb.Error | pl.exceptions.PolarsError):
		return HTTPException(status_code=400, detail=str(error).strip())
	raise error


@router.post('/open', response_model=FrameInfo)
async def open_frame(request: Request, body: OpenRequest) -> FrameInfo:
	try:
		return await _store(request).open(body.path)
	except Exception as error:
		raise _fail(error) from error


@router.post('/{frame_id}/rows', response_model=Page)
async def rows(request: Request, frame_id: str, body: RowsRequest) -> Page:
	try:
		return await _store(request).rows(
			frame_id,
			body.offset,
			body.limit,
			[(s.column, s.desc) for s in body.sort],
			body.where,
			body.sql,
		)
	except Exception as error:
		raise _fail(error) from error


@router.get('/{frame_id}/summary')
async def summary(request: Request, frame_id: str) -> list[dict[str, Any]]:
	try:
		return await _store(request).summary(frame_id)
	except Exception as error:
		raise _fail(error) from error


@router.post('/{frame_id}/histogram')
async def histogram(request: Request, frame_id: str, body: HistogramRequest) -> dict[str, Any]:
	try:
		return await _store(request).histogram(frame_id, body.column, body.bins)
	except Exception as error:
		raise _fail(error) from error


@router.delete('/{frame_id}', status_code=204)
async def close(request: Request, frame_id: str) -> None:
	_store(request).close_frame(frame_id)
