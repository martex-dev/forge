import json
import logging
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger('forge_sidecar.cache')


@dataclass
class CacheEntry:
	value: Any
	fetched_at: float


class CoolingDown(Exception):
	"""Raised while waiting out a failed refresh (e.g. HTTP 429) with nothing cached."""

	def __init__(self, retry_in: float, cause: str) -> None:
		super().__init__(cause)
		self.retry_in = retry_in
		self.cause = cause


class TtlCache:
	"""
	Fresh-for-`ttl` cache with stale fallback: if a refresh fails, the last good value is served
	(marked stale) for up to `max_stale`. Optionally persisted to disk so a sidecar restart
	doesn't re-hit rate-limited upstreams.
	"""

	def __init__(
		self,
		ttl: float,
		max_stale: float,
		persist_dir: Path | None = None,
		clock: Callable[[], float] = time.time,
		fail_cooldown: float = 0.0,
	) -> None:
		self.ttl = ttl
		self.fail_cooldown = fail_cooldown
		self._failed: dict[str, tuple[float, str]] = {}
		self.max_stale = max_stale
		self.persist_dir = persist_dir
		self.clock = clock
		self._entries: dict[str, CacheEntry] = {}

	def _path(self, key: str) -> Path | None:
		if not self.persist_dir:
			return None
		safe = ''.join(c if c.isalnum() or c in '-_' else '_' for c in key)
		return self.persist_dir / f'{safe}.json'

	def _load(self, key: str) -> CacheEntry | None:
		entry = self._entries.get(key)
		if entry:
			return entry
		path = self._path(key)
		if not path or not path.exists():
			return None
		try:
			raw = json.loads(path.read_text(encoding='utf-8'))
			entry = CacheEntry(value=raw['value'], fetched_at=float(raw['fetched_at']))
		except (OSError, ValueError, KeyError) as error:
			logger.warning('ignoring unreadable cache file %s: %s', path, error)
			return None
		self._entries[key] = entry
		return entry

	def _store(self, key: str, entry: CacheEntry) -> None:
		self._entries[key] = entry
		path = self._path(key)
		if not path:
			return
		try:
			path.parent.mkdir(parents=True, exist_ok=True)
			tmp = path.with_suffix('.tmp')
			tmp.write_text(
				json.dumps({'value': entry.value, 'fetched_at': entry.fetched_at}), encoding='utf-8'
			)
			tmp.replace(path)
		except OSError as error:
			logger.warning('could not persist cache %s: %s', path, error)

	async def get(self, key: str, fetch: Callable[[], Awaitable[Any]]) -> tuple[Any, float, bool]:
		"""Returns (value, fetched_at, stale)."""
		now = self.clock()
		entry = self._load(key)
		if entry and now - entry.fetched_at < self.ttl:
			return entry.value, entry.fetched_at, False
		failed = self._failed.get(key)
		if failed and now < failed[0]:
			# Still cooling down after a failure: don't touch the upstream again yet.
			if entry and now - entry.fetched_at < self.max_stale:
				return entry.value, entry.fetched_at, True
			raise CoolingDown(failed[0] - now, failed[1])
		try:
			value = await fetch()
		except Exception as error:
			retry_after = getattr(error, 'retry_after', None)
			wait = float(retry_after) if retry_after else self.fail_cooldown
			if wait > 0:
				self._failed[key] = (now + wait, str(error))
			if entry and now - entry.fetched_at < self.max_stale:
				logger.warning('refresh of %s failed, serving stale copy: %s', key, error)
				return entry.value, entry.fetched_at, True
			raise
		self._failed.pop(key, None)
		fresh = CacheEntry(value=value, fetched_at=now)
		self._store(key, fresh)
		return value, now, False
