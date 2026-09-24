import platform
from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel

from forge_sidecar import __version__

router = APIRouter(tags=['health'])


class HealthResponse(BaseModel):
	status: Literal['ok']
	version: str
	python: str


@router.get('/health', response_model=HealthResponse)
async def health() -> HealthResponse:
	return HealthResponse(status='ok', version=__version__, python=platform.python_version())
