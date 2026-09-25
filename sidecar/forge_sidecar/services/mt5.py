"""
MetaTrader 5, strictly read-only. This module never calls order_send/order_check or anything
that changes the account; it only reads account info, positions and deal history.
"""

import logging
import os
import subprocess
import sys
import threading
import time
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel

logger = logging.getLogger('forge_sidecar.mt5')

POSITION_TYPES = {0: 'buy', 1: 'sell'}
DEAL_TYPES = {0: 'buy', 1: 'sell', 2: 'balance', 3: 'credit', 4: 'charge', 5: 'correction'}
DEAL_ENTRIES = {0: 'in', 1: 'out', 2: 'inout', 3: 'out_by'}
TRADE_MODES = {0: 'demo', 1: 'contest', 2: 'real'}
TASKLIST = os.path.join(os.environ.get('SystemRoot', r'C:\Windows'), 'System32', 'tasklist.exe')


class Mt5Account(BaseModel):
	login: int
	name: str
	server: str
	company: str
	currency: str
	mode: str
	leverage: int
	balance: float
	equity: float
	profit: float
	margin: float
	margin_free: float
	margin_level: float | None


class Mt5Position(BaseModel):
	ticket: int
	symbol: str
	side: str
	volume: float
	price_open: float
	price_current: float
	sl: float | None
	tp: float | None
	profit: float
	swap: float
	opened_at: int  # epoch seconds (server time as reported by MT5)
	comment: str


class Mt5Deal(BaseModel):
	ticket: int
	position: int
	symbol: str
	side: str
	entry: str
	volume: float
	price: float
	profit: float
	commission: float
	swap: float
	time: int
	comment: str


class Mt5Status(BaseModel):
	available: bool
	connected: bool
	reason: str | None = None
	account: Mt5Account | None = None


def terminal_running() -> bool:
	"""We attach to a running terminal only; initialize() would otherwise launch one."""
	if sys.platform != 'win32':
		return False
	try:
		out = subprocess.run(  # noqa: S603 - fixed arguments, nothing user-supplied
			[TASKLIST, '/FI', 'IMAGENAME eq terminal64.exe', '/NH'],
			capture_output=True,
			text=True,
			timeout=5,
			creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0),
			check=False,
		).stdout
	except (OSError, subprocess.SubprocessError) as error:
		logger.warning('tasklist failed: %s', error)
		return False
	return 'terminal64.exe' in out.lower()


def _opt(value: float) -> float | None:
	return float(value) if value else None


def map_account(a: Any) -> Mt5Account:
	return Mt5Account(
		login=int(a.login),
		name=str(a.name),
		server=str(a.server),
		company=str(a.company),
		currency=str(a.currency),
		mode=TRADE_MODES.get(int(a.trade_mode), 'unknown'),
		leverage=int(a.leverage),
		balance=float(a.balance),
		equity=float(a.equity),
		profit=float(a.profit),
		margin=float(a.margin),
		margin_free=float(a.margin_free),
		margin_level=_opt(a.margin_level),
	)


def map_position(p: Any) -> Mt5Position:
	return Mt5Position(
		ticket=int(p.ticket),
		symbol=str(p.symbol),
		side=POSITION_TYPES.get(int(p.type), 'unknown'),
		volume=float(p.volume),
		price_open=float(p.price_open),
		price_current=float(p.price_current),
		sl=_opt(p.sl),
		tp=_opt(p.tp),
		profit=float(p.profit),
		swap=float(p.swap),
		opened_at=int(p.time),
		comment=str(p.comment),
	)


def map_deal(d: Any) -> Mt5Deal:
	return Mt5Deal(
		ticket=int(d.ticket),
		position=int(d.position_id),
		symbol=str(d.symbol),
		side=DEAL_TYPES.get(int(d.type), 'other'),
		entry=DEAL_ENTRIES.get(int(d.entry), 'other'),
		volume=float(d.volume),
		price=float(d.price),
		profit=float(d.profit),
		commission=float(d.commission),
		swap=float(d.swap),
		time=int(d.time),
		comment=str(d.comment),
	)


class Mt5Service:
	"""The MT5 Python API is synchronous and not thread-safe: one lock, calls run in a thread."""

	def __init__(
		self,
		loader: Callable[[], Any] | None = None,
		is_running: Callable[[], bool] = terminal_running,
	) -> None:
		self._loader = loader or self._import
		self._is_running = is_running
		self._mt5: Any = None
		self._connected = False
		self._lock = threading.Lock()

	@staticmethod
	def _import() -> Any:
		# Imported lazily: Windows-only, and the sidecar must start without it.
		import MetaTrader5

		return MetaTrader5

	def _connect(self) -> str | None:
		"""None when connected, else a reason to show the user."""
		if self._mt5 is None:
			try:
				self._mt5 = self._loader()
			except ImportError:
				return 'The MetaTrader5 Python package is not installed (Windows only).'
		if self._connected and self._mt5.terminal_info() is not None:
			return None
		self._connected = False
		if not self._is_running():
			return 'MetaTrader 5 is not running. Start it and log in to your account.'
		if not self._mt5.initialize():
			return f'Could not attach to MetaTrader 5: {self._mt5.last_error()}'
		self._connected = True
		return None

	def status(self) -> Mt5Status:
		with self._lock:
			reason = self._connect()
			if reason:
				return Mt5Status(available=self._mt5 is not None, connected=False, reason=reason)
			info = self._mt5.account_info()
			if info is None:
				return Mt5Status(
					available=True,
					connected=True,
					reason='The terminal is not logged in to an account.',
				)
			return Mt5Status(available=True, connected=True, account=map_account(info))

	def positions(self) -> list[Mt5Position]:
		with self._lock:
			if self._connect():
				return []
			return [map_position(p) for p in (self._mt5.positions_get() or ())]

	def history(self, days: int) -> list[Mt5Deal]:
		with self._lock:
			if self._connect():
				return []
			now = time.time()
			# MT5 wants datetimes; the extra day covers broker server time zones ahead of UTC.
			start = datetime.fromtimestamp(now - days * 86_400, UTC)
			end = datetime.fromtimestamp(now + 86_400, UTC)
			deals = self._mt5.history_deals_get(start, end) or ()
			return sorted((map_deal(d) for d in deals), key=lambda d: d.time, reverse=True)

	def close(self) -> None:
		with self._lock:
			if self._mt5 is not None and self._connected:
				self._mt5.shutdown()
			self._connected = False
