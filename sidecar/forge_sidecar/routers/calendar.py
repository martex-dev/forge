from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Request

from forge_sidecar.services.cache import CoolingDown
from forge_sidecar.services.ff_calendar import CalendarWeek, fetch_week, parse_events

router = APIRouter(prefix='/calendar', tags=['calendar'])


@router.get('/week', response_model=CalendarWeek)
async def week(request: Request) -> CalendarWeek:
	state = request.app.state
	try:
		raw, fetched_at, stale = await state.calendar_cache.get(
			'ff-week', lambda: fetch_week(state.http)
		)
	except CoolingDown as error:
		minutes = max(1, round(error.retry_in / 60))
		raise HTTPException(
			status_code=503,
			detail=f'{error.cause}. Retrying automatically in about {minutes} min.',
		) from error
	except Exception as error:
		raise HTTPException(
			status_code=502, detail=f'Calendar feed unavailable: {error}'
		) from error
	return CalendarWeek(
		source='forexfactory',
		events=parse_events(raw),
		fetched_at=datetime.fromtimestamp(fetched_at, UTC),
		stale=stale,
	)
