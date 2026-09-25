from datetime import date

import httpx
from fastapi import APIRouter, Header, HTTPException, Request

from forge_sidecar.services.cache import CoolingDown
from forge_sidecar.services.earnings import EarningsRange
from forge_sidecar.services.earnings_sources import Source, SourceError

router = APIRouter(prefix='/earnings', tags=['earnings'])


@router.get('/range', response_model=EarningsRange)
async def earnings_range(
	request: Request,
	start: date,
	end: date,
	source: Source = 'nasdaq',
	index_only: bool = True,
	# Keys and URLs travel in headers, never in the query string.
	x_finnhub_token: str | None = Header(default=None),
	x_market_calendar_url: str | None = Header(default=None),
) -> EarningsRange:
	if x_market_calendar_url and not x_market_calendar_url.startswith(
		('https://', 'http://localhost', 'http://127.0.0.1')
	):
		raise HTTPException(status_code=422, detail='The Market Calendar URL must use https://')
	try:
		return await request.app.state.earnings.get(
			source, start, end, index_only, x_finnhub_token, x_market_calendar_url
		)
	except ValueError as error:
		raise HTTPException(status_code=422, detail=str(error)) from error
	except CoolingDown as error:
		minutes = max(1, round(error.retry_in / 60))
		raise HTTPException(
			status_code=503, detail=f'{error.cause}; retrying in about {minutes} min'
		) from error
	except SourceError as error:
		raise HTTPException(status_code=502, detail=str(error)) from error
	except httpx.HTTPError as error:
		raise HTTPException(status_code=502, detail='Earnings source unreachable') from error
