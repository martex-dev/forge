import asyncio

from fastapi import APIRouter, Request

from forge_sidecar.services.gpu import GpuSnapshot

router = APIRouter(prefix='/gpu', tags=['gpu'])


@router.get('', response_model=GpuSnapshot)
async def gpu(request: Request) -> GpuSnapshot:
	# NVML calls block for a few ms per GPU; keep them off the event loop.
	return await asyncio.to_thread(request.app.state.gpu.snapshot)
