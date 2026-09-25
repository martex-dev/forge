"""SQL helpers for the DataFrame viewer: quoting, the single-SELECT rule and JSON-safe values."""

import datetime as dt
import math
import uuid
from decimal import Decimal
from typing import Any

import duckdb

MAX_CELL_CHARS = 2000


class QueryRejected(ValueError):
	"""The SQL isn't a single read-only SELECT."""


def quote_ident(name: str) -> str:
	return '"' + name.replace('"', '""') + '"'


def quote_literal(text: str) -> str:
	return "'" + text.replace("'", "''") + "'"


def check_select(conn: duckdb.DuckDBPyConnection, sql: str) -> None:
	"""
	Only one SELECT (WITH, FROM-first, SUMMARIZE and DESCRIBE parse as SELECT too). This is what
	makes the SQL box and the WHERE filter safe to run: no COPY TO, ATTACH, INSTALL, SET or a
	second statement smuggled in after a semicolon.
	"""
	try:
		statements = conn.extract_statements(sql)
	except duckdb.Error as error:
		raise QueryRejected(str(error)) from error
	if len(statements) != 1:
		raise QueryRejected('Run one statement at a time')
	if statements[0].type != duckdb.StatementType.SELECT:
		raise QueryRejected('Only SELECT queries are allowed here (the viewer is read-only)')


def to_json_value(value: Any) -> Any:
	"""Converts DuckDB's Python values into something JSON can carry without losing meaning."""
	if value is None or isinstance(value, bool | int | str):
		if isinstance(value, str) and len(value) > MAX_CELL_CHARS:
			return value[:MAX_CELL_CHARS] + '…'
		return value
	if isinstance(value, float):
		# JSON has no NaN/Infinity; strings keep them visible instead of turning them into null.
		return value if math.isfinite(value) else str(value)
	if isinstance(value, Decimal):
		return float(value)
	if isinstance(value, dt.datetime | dt.date | dt.time):
		return value.isoformat()
	if isinstance(value, dt.timedelta):
		return str(value)
	if isinstance(value, uuid.UUID):
		return str(value)
	if isinstance(value, bytes | bytearray | memoryview):
		return f'<{len(bytes(value))} bytes>'
	if isinstance(value, list | tuple):
		return [to_json_value(v) for v in value]
	if isinstance(value, dict):
		return {str(k): to_json_value(v) for k, v in value.items()}
	return str(value)


NUMERIC_TYPES = (
	'TINYINT',
	'SMALLINT',
	'INTEGER',
	'BIGINT',
	'HUGEINT',
	'UTINYINT',
	'USMALLINT',
	'UINTEGER',
	'UBIGINT',
	'UHUGEINT',
	'FLOAT',
	'DOUBLE',
	'DECIMAL',
)


def is_numeric(duck_type: str) -> bool:
	return duck_type.upper().startswith(NUMERIC_TYPES)
