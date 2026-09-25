import json
import math
import sqlite3
import threading
import time
from pathlib import Path
from typing import Any, Literal

from pydantic import BaseModel

RunStatus = Literal['running', 'finished', 'failed', 'interrupted']
# Keeps one pathological run (a metric logged every micro-step) from exhausting memory in the UI.
MAX_POINTS_PER_FETCH = 50_000

SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
	id TEXT PRIMARY KEY,
	name TEXT NOT NULL,
	project TEXT,
	config TEXT NOT NULL DEFAULT '{}',
	status TEXT NOT NULL,
	error TEXT,
	started_at REAL NOT NULL,
	ended_at REAL,
	updated_at REAL NOT NULL,
	pid INTEGER,
	host TEXT,
	script TEXT,
	last_step INTEGER
);
CREATE TABLE IF NOT EXISTS metrics (
	seq INTEGER PRIMARY KEY AUTOINCREMENT,
	run_id TEXT NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
	key TEXT NOT NULL,
	step INTEGER NOT NULL,
	value REAL,
	t REAL NOT NULL,
	UNIQUE (run_id, key, step)
);
CREATE INDEX IF NOT EXISTS metrics_run_seq ON metrics(run_id, seq);
"""


class Run(BaseModel):
	id: str
	name: str
	project: str | None
	status: RunStatus
	error: str | None
	started_at: float
	ended_at: float | None
	updated_at: float
	pid: int | None
	host: str | None
	script: str | None
	last_step: int | None
	metric_keys: list[str]


class RunDetail(Run):
	config: dict[str, Any]


class MetricPoint(BaseModel):
	key: str
	step: int
	value: float | None  # None = NaN/inf was logged (a diverged loss is worth seeing)


class MetricsPage(BaseModel):
	points: list[MetricPoint]
	cursor: int
	more: bool


def _finite(value: Any) -> float | None:
	try:
		number = float(value)
	except (TypeError, ValueError):
		return None
	return number if math.isfinite(number) else None


class RunsStore:
	"""SQLite store for probe runs. One connection, guarded by a lock; writes are tiny and fast."""

	def __init__(self, path: Path | None, clock: Any = time.time) -> None:
		if path:
			path.parent.mkdir(parents=True, exist_ok=True)
		self.clock = clock
		self._lock = threading.Lock()
		self._db = sqlite3.connect(str(path) if path else ':memory:', check_same_thread=False)
		self._db.row_factory = sqlite3.Row
		self._db.execute('PRAGMA foreign_keys = ON')
		if path:
			self._db.execute('PRAGMA journal_mode = WAL')
		self._db.executescript(SCHEMA)
		# Runs left 'running' by a sidecar crash can't still be streaming to us.
		self._db.execute(
			"UPDATE runs SET status = 'interrupted', ended_at = updated_at WHERE status = 'running'"
		)
		self._db.commit()

	def close(self) -> None:
		with self._lock:
			self._db.close()

	def start(
		self,
		run_id: str,
		name: str,
		config: dict[str, Any],
		started_at: float,
		project: str | None = None,
		pid: int | None = None,
		host: str | None = None,
		script: str | None = None,
	) -> None:
		"""Idempotent: probes re-announce their run on every reconnect."""
		now = self.clock()
		with self._lock, self._db:
			self._db.execute(
				"""
				INSERT INTO runs (id, name, project, config, status, started_at, updated_at,
					pid, host, script)
				VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?, ?)
				ON CONFLICT(id) DO UPDATE SET
					status = 'running', ended_at = NULL, error = NULL,
					updated_at = excluded.updated_at
				""",
				(run_id, name, project, json.dumps(config), started_at, now, pid, host, script),
			)

	def log(self, run_id: str, step: int, t: float, metrics: dict[str, Any]) -> None:
		rows = [(run_id, key, step, _finite(value), t) for key, value in metrics.items()]
		with self._lock, self._db:
			self._db.executemany(
				"""
				-- REPLACE (not an upsert) gives a re-logged step a new seq, so cursors pick it up.
				INSERT OR REPLACE INTO metrics (run_id, key, step, value, t) VALUES (?, ?, ?, ?, ?)
				""",
				rows,
			)
			self._db.execute(
				'UPDATE runs SET last_step = MAX(COALESCE(last_step, ?), ?), updated_at = ? '
				'WHERE id = ?',
				(step, step, self.clock(), run_id),
			)

	def finish(self, run_id: str, status: RunStatus, error: str | None = None) -> None:
		now = self.clock()
		with self._lock, self._db:
			self._db.execute(
				'UPDATE runs SET status = ?, error = ?, ended_at = ?, updated_at = ? WHERE id = ?',
				(status, error, now, now, run_id),
			)

	def interrupt(self, run_ids: list[str]) -> None:
		"""The probe's connection dropped without a finish message (killed, crashed)."""
		now = self.clock()
		with self._lock, self._db:
			self._db.executemany(
				"UPDATE runs SET status = 'interrupted', ended_at = ?, updated_at = ? "
				"WHERE id = ? AND status = 'running'",
				[(now, now, run_id) for run_id in run_ids],
			)

	def _keys(self, run_id: str) -> list[str]:
		rows = self._db.execute(
			'SELECT DISTINCT key FROM metrics WHERE run_id = ? ORDER BY key', (run_id,)
		)
		return [r['key'] for r in rows]

	def _run(self, row: sqlite3.Row) -> dict[str, Any]:
		data = {k: row[k] for k in row.keys() if k != 'config'}
		return {**data, 'metric_keys': self._keys(row['id'])}

	def list(self, limit: int = 200) -> list[Run]:
		with self._lock:
			rows = self._db.execute(
				'SELECT * FROM runs ORDER BY started_at DESC LIMIT ?', (limit,)
			).fetchall()
			return [Run(**self._run(r)) for r in rows]

	def get(self, run_id: str) -> RunDetail | None:
		with self._lock:
			row = self._db.execute('SELECT * FROM runs WHERE id = ?', (run_id,)).fetchone()
			if row is None:
				return None
			return RunDetail(**self._run(row), config=json.loads(row['config']))

	def metrics(self, run_id: str, after: int = 0) -> MetricsPage:
		with self._lock:
			rows = self._db.execute(
				'SELECT seq, key, step, value FROM metrics WHERE run_id = ? AND seq > ? '
				'ORDER BY seq LIMIT ?',
				(run_id, after, MAX_POINTS_PER_FETCH + 1),
			).fetchall()
		more = len(rows) > MAX_POINTS_PER_FETCH
		rows = rows[:MAX_POINTS_PER_FETCH]
		return MetricsPage(
			points=[MetricPoint(key=r['key'], step=r['step'], value=r['value']) for r in rows],
			cursor=rows[-1]['seq'] if rows else after,
			more=more,
		)

	def delete(self, run_id: str) -> bool:
		with self._lock, self._db:
			return self._db.execute('DELETE FROM runs WHERE id = ?', (run_id,)).rowcount > 0
