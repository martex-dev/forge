import httpx
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel

from forge_sidecar.services.cache import CoolingDown
from forge_sidecar.services.charts import Candle, ChartUpstreamError, Interval

router = APIRouter(prefix='/chart', tags=['chart'])


class CandleSeries(BaseModel):
	candles: list[Candle]
	stale: bool


def _http_error(source: str, error: Exception) -> HTTPException:
	if isinstance(error, ChartUpstreamError):
		return HTTPException(status_code=error.status, detail=error.message)
	if isinstance(error, CoolingDown):
		return HTTPException(status_code=503, detail=error.cause)
	return HTTPException(status_code=502, detail=f'{source} unavailable: {error}')


@router.get('/binance', response_model=CandleSeries)
async def binance(
	request: Request,
	symbol: str = Query(pattern=r'^[A-Z0-9]{5,20}$'),
	interval: Interval = '1h',
	limit: int = Query(default=500, ge=10, le=1000),
) -> CandleSeries:
	try:
		candles, stale = await request.app.state.charts.binance(symbol, interval, limit)
	except (ChartUpstreamError, CoolingDown, httpx.HTTPError, ValueError) as error:
		raise _http_error('Binance', error) from error
	return CandleSeries(candles=candles, stale=stale)


@router.get('/gecko', response_model=CandleSeries)
async def gecko(
	request: Request,
	chain: str = Query(pattern=r'^[a-z0-9-]{2,32}$'),
	pool: str = Query(pattern=r'^[A-Za-z0-9]{20,100}$'),
	interval: Interval = '1h',
	limit: int = Query(default=500, ge=10, le=1000),
) -> CandleSeries:
	try:
		candles, stale = await request.app.state.charts.gecko(chain, pool, interval, limit)
	except (ChartUpstreamError, CoolingDown, httpx.HTTPError, ValueError) as error:
		raise _http_error('GeckoTerminal', error) from error
	return CandleSeries(candles=candles, stale=stale)
