import re

import httpx
from fastapi import APIRouter, HTTPException, Query, Request

from forge_sidecar.services.dexscreener import DexPair

router = APIRouter(prefix='/dex', tags=['dexscreener'])

# chain ids are lowercase slugs; addresses are base58 (Solana) or 0x-hex (EVM).
_ID = re.compile(r'^[a-z0-9-]{2,32}:[A-Za-z0-9]{20,100}$')


def _upstream_error(error: Exception) -> HTTPException:
	if isinstance(error, httpx.HTTPStatusError) and error.response.status_code == 429:
		return HTTPException(status_code=503, detail='DexScreener is rate-limiting requests')
	return HTTPException(status_code=502, detail=f'DexScreener unavailable: {error}')


@router.get('/search', response_model=list[DexPair])
async def search(request: Request, q: str = Query(min_length=2, max_length=100)) -> list[DexPair]:
	try:
		return await request.app.state.dex.search(q)
	except (httpx.HTTPError, ValueError) as error:
		raise _upstream_error(error) from error


@router.get('/pairs', response_model=list[DexPair])
async def pairs(request: Request, ids: str = Query(max_length=20_000)) -> list[DexPair]:
	"""`ids` is a comma-separated list of `chainId:pairAddress`."""
	parsed: list[tuple[str, str]] = []
	for item in filter(None, ids.split(',')):
		if not _ID.match(item):
			raise HTTPException(status_code=422, detail=f'Invalid pair id: {item[:80]}')
		chain, address = item.split(':', 1)
		parsed.append((chain, address))
	if len(parsed) > 200:
		raise HTTPException(status_code=422, detail='Too many pairs (max 200)')
	try:
		return await request.app.state.dex.pairs(parsed)
	except (httpx.HTTPError, ValueError) as error:
		raise _upstream_error(error) from error
