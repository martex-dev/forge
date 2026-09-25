import hashlib
from datetime import UTC, datetime
from typing import Any, Literal

import httpx
from pydantic import BaseModel

FF_WEEK_URL = 'https://nfs.faireconomy.media/ff_calendar_thisweek.json'

Impact = Literal['high', 'medium', 'low', 'holiday', 'none']


class CalendarEvent(BaseModel):
	id: str
	title: str
	currency: str
	time: datetime
	impact: Impact
	forecast: str | None
	previous: str | None


class CalendarWeek(BaseModel):
	source: Literal['forexfactory']
	events: list[CalendarEvent]
	fetched_at: datetime
	stale: bool


_IMPACTS: dict[str, Impact] = {
	'high': 'high',
	'medium': 'medium',
	'low': 'low',
	'holiday': 'holiday',
	'non-economic': 'none',
}


def _blank(value: Any) -> str | None:
	text = str(value).strip() if value is not None else ''
	return text or None


def parse_events(raw: Any) -> list[CalendarEvent]:
	"""
	Normalizes the Forex Factory weekly feed. The feed has no stable ids, so one is derived from
	currency + time + title. Malformed rows are skipped rather than failing the whole week.
	"""
	if not isinstance(raw, list):
		raise ValueError('calendar feed is not a list')
	events: list[CalendarEvent] = []
	for row in raw:
		if not isinstance(row, dict):
			continue
		try:
			when = datetime.fromisoformat(str(row['date'])).astimezone(UTC)
			title = str(row['title']).strip()
			currency = str(row['country']).strip().upper()
		except (KeyError, ValueError):
			continue
		impact = _IMPACTS.get(str(row.get('impact', '')).strip().lower(), 'none')
		digest = hashlib.blake2b(
			f'{currency}|{when.isoformat()}|{title}'.encode(), digest_size=8
		).hexdigest()
		events.append(
			CalendarEvent(
				id=digest,
				title=title,
				currency=currency,
				time=when,
				impact=impact,
				forecast=_blank(row.get('forecast')),
				previous=_blank(row.get('previous')),
			)
		)
	events.sort(key=lambda e: (e.time, e.currency, e.title))
	return events


class UpstreamError(Exception):
	def __init__(self, message: str, retry_after: float | None = None) -> None:
		super().__init__(message)
		self.retry_after = retry_after


async def fetch_week(client: httpx.AsyncClient) -> list[dict[str, Any]]:
	response = await client.get(FF_WEEK_URL, timeout=15.0)
	if response.status_code == 429:
		header = response.headers.get('retry-after', '')
		retry = float(header) if header.isdigit() else None
		raise UpstreamError('Forex Factory is rate-limiting requests', retry_after=retry)
	if response.status_code >= 400:
		raise UpstreamError(f'Forex Factory feed returned HTTP {response.status_code}')
	data = response.json()
	if not isinstance(data, list):
		raise ValueError('unexpected calendar payload')
	return data
