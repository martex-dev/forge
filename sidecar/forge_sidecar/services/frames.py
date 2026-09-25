"""
DataFrame viewer backend. Each opened file gets its own in-memory DuckDB database with one view,
`t`, over the file, so queries always see the file's current contents and SQL can say `FROM t`.
"""

import asyncio
import hashlib
import logging
import threading
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Literal

import duckdb
import polars as pl
from pydantic import BaseModel

from forge_sidecar.services.frame_sql import (
	QueryRejected,
	check_select,
	is_numeric,
	quote_ident,
	quote_literal,
	to_json_value,
)

logger = logging.getLogger('forge_sidecar.frames')

FrameFormat = Literal['csv', 'parquet', 'json', 'arrow']
FORMATS: dict[str, FrameFormat] = {
	'.csv': 'csv',
	'.tsv': 'csv',
	'.txt': 'csv',
	'.parquet': 'parquet',
	'.pq': 'parquet',
	'.json': 'json',
	'.jsonl': 'json',
	'.ndjson': 'json',
	'.feather': 'arrow',
	'.arrow': 'arrow',
	'.ipc': 'arrow',
}
QUERY_TIMEOUT = 30.0
MAX_OPEN = 12


class Column(BaseModel):
	name: str
	type: str


class FrameInfo(BaseModel):
	id: str
	path: str
	format: FrameFormat
	columns: list[Column]
	row_count: int


class Page(BaseModel):
	columns: list[Column]
	rows: list[list[Any]]
	total: int
	offset: int


class FrameNotFound(KeyError):
	pass


@dataclass
class Frame:
	info: FrameInfo
	conn: duckdb.DuckDBPyConnection
	totals: dict[str, int] = field(default_factory=dict)
	lock: threading.Lock = field(default_factory=threading.Lock)


def _harden(conn: duckdb.DuckDBPyConnection) -> None:
	# No downloading extensions from a query (read_csv('https://…') would fetch httpfs), no
	# scanning Python variables by name, and nothing a query can SET afterwards.
	for setting in (
		'autoinstall_known_extensions=false',
		'autoload_known_extensions=false',
		'allow_community_extensions=false',
		'python_enable_replacements=false',
		'lock_configuration=true',
	):
		conn.execute(f'SET {setting}')


class FrameStore:
	def __init__(self, cache_dir: Path | None) -> None:
		self.cache_dir = cache_dir
		self.frames: dict[str, Frame] = {}

	def close(self) -> None:
		for frame in self.frames.values():
			frame.conn.close()
		self.frames.clear()

	def _source(self, path: Path, fmt: FrameFormat) -> str:
		literal = quote_literal(str(path))
		if fmt == 'csv':
			return f'read_csv({literal}, auto_detect = true, sample_size = 20480)'
		if fmt == 'parquet':
			return f'read_parquet({literal})'
		if fmt == 'json':
			return f'read_json_auto({literal})'
		# DuckDB reads Arrow IPC only through an extension it would download; polars converts it
		# once into a cached Parquet file keyed by path + mtime + size instead.
		stat = path.stat()
		key = hashlib.blake2b(
			f'{path}|{stat.st_mtime_ns}|{stat.st_size}'.encode(), digest_size=10
		).hexdigest()
		folder = (self.cache_dir or Path.cwd()) / 'frames'
		folder.mkdir(parents=True, exist_ok=True)
		target = folder / f'{key}.parquet'
		if not target.exists():
			pl.read_ipc(path, memory_map=False).write_parquet(target)
		return f'read_parquet({quote_literal(str(target))})'

	def _open_sync(self, raw_path: str) -> Frame:
		"""Builds the frame off the event loop; registering it happens on the loop (see open)."""
		path = Path(raw_path)
		fmt = FORMATS.get(path.suffix.lower())
		if not path.is_absolute() or fmt is None:
			raise ValueError('Open an absolute path to a CSV, TSV, Parquet, JSON or Feather file')
		if not path.is_file():
			raise FileNotFoundError(f'{path} does not exist')
		conn = duckdb.connect(':memory:')
		try:
			conn.execute(f'CREATE VIEW t AS SELECT * FROM {self._source(path, fmt)}')
			_harden(conn)
			columns = [
				Column(name=str(r[0]), type=str(r[1]))
				for r in conn.execute('DESCRIBE SELECT * FROM t').fetchall()
			]
			count = conn.execute('SELECT count(*) FROM t').fetchone()
		except Exception:
			conn.close()
			raise
		info = FrameInfo(
			id=uuid.uuid4().hex,
			path=str(path),
			format=fmt,
			columns=columns,
			row_count=int(count[0]) if count else 0,
		)
		return Frame(info=info, conn=conn)

	def get(self, frame_id: str) -> Frame:
		frame = self.frames.get(frame_id)
		if frame is None:
			raise FrameNotFound(frame_id)
		return frame

	async def _run(self, frame: Frame, work: Any) -> Any:
		"""Runs blocking DuckDB work in a thread, one query per frame at a time, with a timeout."""
		cursor = frame.conn.cursor()

		def guarded() -> Any:
			with frame.lock:
				return work(cursor)

		try:
			return await asyncio.wait_for(asyncio.to_thread(guarded), QUERY_TIMEOUT)
		except TimeoutError as error:
			cursor.interrupt()
			raise QueryRejected(f'The query ran longer than {QUERY_TIMEOUT:.0f} s') from error
		finally:
			cursor.close()

	async def open(self, path: str) -> FrameInfo:
		frame = await asyncio.to_thread(self._open_sync, path)
		# Re-opening a path replaces its frame: the schema may have changed on disk.
		for old in [f for f in self.frames.values() if f.info.path == frame.info.path]:
			self.close_frame(old.info.id)
		while len(self.frames) >= MAX_OPEN:
			self.close_frame(next(iter(self.frames)))
		self.frames[frame.info.id] = frame
		return frame.info

	def _query(self, frame: Frame, sql: str | None, where: str | None) -> str:
		base = sql.strip().rstrip(';') if sql and sql.strip() else 'SELECT * FROM t'
		# Checked on its own first so a COPY or ATTACH gets a clear refusal, not the parser error
		# the wrapped form would produce. The wrapped query is checked again below.
		check_select(frame.conn, base)
		query = f'SELECT * FROM ({base}) AS q'
		if where and where.strip():
			query += f' WHERE ({where})'
		check_select(frame.conn, query)
		return query

	async def rows(
		self,
		frame_id: str,
		offset: int,
		limit: int,
		sort: list[tuple[str, bool]],
		where: str | None = None,
		sql: str | None = None,
	) -> Page:
		frame = self.get(frame_id)
		query = self._query(frame, sql, where)

		def work(cur: duckdb.DuckDBPyConnection) -> Page:
			if query not in frame.totals:
				if len(frame.totals) > 50:
					frame.totals.clear()
				row = cur.execute(f'SELECT count(*) FROM ({query}) AS c').fetchone()
				frame.totals[query] = int(row[0]) if row else 0
			ordered = query
			if sort:
				order = ', '.join(
					f'{quote_ident(col)} {"DESC" if desc else "ASC"} NULLS LAST'
					for col, desc in sort
				)
				ordered = f'SELECT * FROM ({query}) AS s ORDER BY {order}'
			cur.execute(f'{ordered} LIMIT ? OFFSET ?', [limit, offset])
			columns = [Column(name=str(d[0]), type=str(d[1])) for d in cur.description or []]
			rows = [[to_json_value(v) for v in r] for r in cur.fetchall()]
			return Page(columns=columns, rows=rows, total=frame.totals[query], offset=offset)

		return await self._run(frame, work)

	async def summary(self, frame_id: str) -> list[dict[str, Any]]:
		frame = self.get(frame_id)

		def work(cur: duckdb.DuckDBPyConnection) -> list[dict[str, Any]]:
			cur.execute('SUMMARIZE SELECT * FROM t')
			names = [str(d[0]) for d in cur.description or []]
			return [
				{k: to_json_value(v) for k, v in zip(names, r, strict=True)} for r in cur.fetchall()
			]

		return await self._run(frame, work)

	async def histogram(self, frame_id: str, column: str, bins: int) -> dict[str, Any]:
		frame = self.get(frame_id)
		col = next((c for c in frame.info.columns if c.name == column), None)
		if col is None:
			raise QueryRejected(f'No column named {column}')
		ident = quote_ident(column)

		def work(cur: duckdb.DuckDBPyConnection) -> dict[str, Any]:
			if not is_numeric(col.type):
				cur.execute(
					f'SELECT CAST({ident} AS VARCHAR) AS v, count(*) AS n FROM t '
					f'GROUP BY v ORDER BY n DESC LIMIT 20'
				)
				pairs = cur.fetchall()
				return {
					'kind': 'categorical',
					'labels': [to_json_value(p[0]) for p in pairs],
					'counts': [int(p[1]) for p in pairs],
				}
			lo_hi = cur.execute(
				f'SELECT min({ident})::DOUBLE, max({ident})::DOUBLE FROM t '
				f'WHERE isfinite({ident}::DOUBLE)'
			).fetchone()
			lo, hi = lo_hi or (None, None)
			if lo is None or hi is None:
				return {'kind': 'numeric', 'edges': [], 'counts': []}
			width = (hi - lo) / bins if hi > lo else 1.0
			cur.execute(
				f'SELECT least(floor(({ident}::DOUBLE - ?) / ?)::INTEGER, ?) AS b, count(*) '
				f'FROM t WHERE isfinite({ident}::DOUBLE) GROUP BY b ORDER BY b',
				[lo, width, bins - 1],
			)
			counts = [0] * bins
			for b, n in cur.fetchall():
				counts[int(b)] = int(n)
			return {
				'kind': 'numeric',
				'edges': [lo + i * width for i in range(bins + 1)],
				'counts': counts,
			}

		return await self._run(frame, work)

	def close_frame(self, frame_id: str) -> None:
		frame = self.frames.pop(frame_id, None)
		if frame:
			# Wait for a running query on it to finish before closing the database under it.
			with frame.lock:
				frame.conn.close()
