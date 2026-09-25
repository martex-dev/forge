import asyncio

from fastapi import APIRouter, Query, Request

from forge_sidecar.services.mt5 import Mt5Deal, Mt5Position, Mt5Status

router = APIRouter(prefix='/mt5', tags=['mt5'])


@router.get('/status', response_model=Mt5Status)
async def status(request: Request) -> Mt5Status:
	return await asyncio.to_thread(request.app.state.mt5.status)


@router.get('/positions', response_model=list[Mt5Position])
async def positions(request: Request) -> list[Mt5Position]:
	return await asyncio.to_thread(request.app.state.mt5.positions)


@router.get('/history', response_model=list[Mt5Deal])
async def history(request: Request, days: int = Query(default=30, ge=1, le=365)) -> list[Mt5Deal]:
	return await asyncio.to_thread(request.app.state.mt5.history, days)
