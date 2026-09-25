"""
S&P 500 + Nasdaq-100 tickers, the allowlist the earnings calendar is filtered to (otherwise NASDAQ
lists ~4,000 companies a week). Sources as in market-calendar: the S&P 500 from Wikipedia's
table#constituents, the Nasdaq-100 from NASDAQ itself (Wikipedia's article has no table).
"""

from html.parser import HTMLParser
from typing import Any

import httpx

from forge_sidecar.services.earnings_sources import (
	NASDAQ_BASE,
	NASDAQ_HEADERS,
	SourceError,
	normalize_symbol,
)

SP500_URL = 'https://en.wikipedia.org/wiki/List_of_S%26P_500_companies'
# A parse that yields fewer means the markup changed: fail loudly rather than filter out every
# earnings row and look like "a quiet week".
MIN_SP500 = 400
# Wikipedia's robot policy wants automated clients to identify themselves with a contact URL;
# a bare product token gets HTTP 403.
WIKI_HEADERS = {
	'User-Agent': 'Forge/0.1 (personal desktop app; https://github.com/martex-dev/forge)',
	'Accept': 'text/html',
}
MIN_NDX = 80


class _ConstituentsTable(HTMLParser):
	"""Collects the first cell of each body row of table#constituents."""

	def __init__(self) -> None:
		super().__init__()
		self.symbols: list[str] = []
		self._depth = 0  # table nesting inside #constituents; 0 = outside
		self._in_row = False
		self._cell = 0
		self._text: list[str] | None = None

	def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
		if tag == 'table':
			if self._depth or dict(attrs).get('id') == 'constituents':
				self._depth += 1
		elif self._depth == 1 and tag == 'tr':
			self._in_row, self._cell = True, 0
		elif self._depth == 1 and self._in_row and tag == 'td':
			self._cell += 1
			if self._cell == 1:
				self._text = []

	def handle_endtag(self, tag: str) -> None:
		if tag == 'table' and self._depth:
			self._depth -= 1
		elif self._depth == 1 and tag == 'td' and self._text is not None:
			symbol = normalize_symbol(''.join(self._text))
			if symbol:
				self.symbols.append(symbol)
			self._text = None
		elif tag == 'tr':
			self._in_row = False

	def handle_data(self, data: str) -> None:
		# Text of a table nested inside a cell isn't the cell's own value.
		if self._text is not None and self._depth == 1:
			self._text.append(data)


def parse_sp500(html: str) -> list[str]:
	parser = _ConstituentsTable()
	parser.feed(html)
	if len(parser.symbols) < MIN_SP500:
		raise SourceError(
			f'S&P 500 list parse found {len(parser.symbols)} symbols; Wikipedia markup changed?'
		)
	return parser.symbols


def parse_nasdaq100(body: Any) -> list[str]:
	data = body.get('data') if isinstance(body, dict) else None
	# NASDAQ nests this one a level deeper than the calendar, sometimes.
	inner = data.get('data') if isinstance(data, dict) else None
	rows = (inner or {}).get('rows') or (data or {}).get('rows') or []
	symbols = [normalize_symbol(str(r.get('symbol') or '')) for r in rows if isinstance(r, dict)]
	symbols = [s for s in symbols if s]
	if len(symbols) < MIN_NDX:
		raise SourceError(f'Nasdaq-100 list has only {len(symbols)} symbols')
	return symbols


async def fetch_constituents(http: httpx.AsyncClient) -> list[str]:
	wiki = await http.get(SP500_URL, headers=WIKI_HEADERS, timeout=30.0)
	if wiki.status_code >= 400:
		raise SourceError(f'Wikipedia S&P 500 page returned HTTP {wiki.status_code}')
	ndx = await http.get(
		f'{NASDAQ_BASE}/quote/list-type/nasdaq100', headers=NASDAQ_HEADERS, timeout=20.0
	)
	if ndx.status_code >= 400:
		raise SourceError(f'NASDAQ-100 list returned HTTP {ndx.status_code}')
	return sorted(set(parse_sp500(wiki.text)) | set(parse_nasdaq100(ndx.json())))
