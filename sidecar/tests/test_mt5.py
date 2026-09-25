from types import SimpleNamespace
from typing import Any

from fastapi.testclient import TestClient

from forge_sidecar.main import create_app
from forge_sidecar.services.mt5 import Mt5Service

TOKEN = 't' * 64
AUTH = {'Authorization': f'Bearer {TOKEN}'}


class FakeMt5:
	"""Stands in for the MetaTrader5 package. It deliberately has no order functions."""

	def __init__(self, logged_in: bool = True) -> None:
		self.logged_in = logged_in
		self.initialized = 0

	def initialize(self) -> bool:
		self.initialized += 1
		return True

	def terminal_info(self) -> Any:
		return SimpleNamespace(connected=True) if self.initialized else None

	def last_error(self) -> tuple[int, str]:
		return (-10003, 'IPC initialize failed')

	def account_info(self) -> Any:
		if not self.logged_in:
			return None
		return SimpleNamespace(
			login=5012345,
			name='Marto',
			server='Broker-Demo',
			company='Broker Ltd',
			currency='USD',
			trade_mode=0,
			leverage=100,
			balance=10_000.0,
			equity=10_125.5,
			profit=125.5,
			margin=250.0,
			margin_free=9_875.5,
			margin_level=4050.2,
		)

	def positions_get(self) -> Any:
		return (
			SimpleNamespace(
				ticket=1,
				symbol='EURUSD',
				type=0,
				volume=0.5,
				price_open=1.0812,
				price_current=1.0837,
				sl=1.0780,
				tp=0.0,
				profit=125.0,
				swap=-0.5,
				time=1_790_000_000,
				comment='',
			),
		)

	def history_deals_get(self, start: Any, end: Any) -> Any:
		deal = {
			'position_id': 7,
			'symbol': 'XAUUSD',
			'volume': 0.1,
			'commission': -0.7,
			'swap': 0.0,
			'comment': '',
		}
		return (
			SimpleNamespace(ticket=10, type=0, entry=0, price=2400.0, profit=0.0, time=100, **deal),
			SimpleNamespace(
				ticket=11, type=1, entry=1, price=2410.0, profit=100.0, time=200, **deal
			),
		)

	def shutdown(self) -> None:
		pass


def test_service_maps_account_positions_and_history() -> None:
	fake = FakeMt5()
	service = Mt5Service(loader=lambda: fake, is_running=lambda: True)
	status = service.status()
	assert status.connected and status.account is not None
	assert (status.account.mode, status.account.equity) == ('demo', 10_125.5)
	[pos] = service.positions()
	assert (pos.side, pos.sl, pos.tp) == ('buy', 1.0780, None)
	deals = service.history(30)
	assert [(d.ticket, d.entry, d.side) for d in deals] == [(11, 'out', 'sell'), (10, 'in', 'buy')]
	assert fake.initialized == 1  # stays attached between calls


def test_service_never_launches_the_terminal() -> None:
	fake = FakeMt5()
	service = Mt5Service(loader=lambda: fake, is_running=lambda: False)
	status = service.status()
	assert not status.connected and status.reason and 'not running' in status.reason
	assert fake.initialized == 0
	assert service.positions() == []


def test_service_reports_missing_package_and_logged_out_terminal() -> None:
	def missing() -> Any:
		raise ImportError('no MetaTrader5')

	assert 'not installed' in (Mt5Service(loader=missing).status().reason or '')
	logged_out = Mt5Service(loader=lambda: FakeMt5(logged_in=False), is_running=lambda: True)
	assert 'not logged in' in (logged_out.status().reason or '')


def test_routes() -> None:
	app = create_app(TOKEN)
	with TestClient(app) as client:
		app.state.mt5 = Mt5Service(loader=lambda: FakeMt5(), is_running=lambda: True)
		assert client.get('/mt5/status', headers=AUTH).json()['account']['login'] == 5012345
		assert client.get('/mt5/positions', headers=AUTH).json()[0]['symbol'] == 'EURUSD'
		assert len(client.get('/mt5/history', params={'days': 7}, headers=AUTH).json()) == 2
		assert client.get('/mt5/history', params={'days': 0}, headers=AUTH).status_code == 422
