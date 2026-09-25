import httpx
from fastapi import APIRouter, Header, HTTPException, Query, Request

from forge_sidecar.services.solana import RpcError, WalletSnapshot, is_address

router = APIRouter(prefix='/solana', tags=['solana'])


@router.get('/wallet', response_model=WalletSnapshot)
async def wallet(
	request: Request,
	address: str = Query(min_length=32, max_length=44),
	refresh: bool = False,
	# A private RPC URL usually embeds an API key: it travels in a header, never in the URL.
	x_solana_rpc: str | None = Header(default=None),
) -> WalletSnapshot:
	if not is_address(address):
		raise HTTPException(status_code=422, detail='Not a Solana public address')
	if x_solana_rpc and not x_solana_rpc.startswith('https://'):
		raise HTTPException(status_code=422, detail='The RPC URL must start with https://')
	try:
		return await request.app.state.solana.snapshot(address, x_solana_rpc, refresh)
	except RpcError as error:
		raise HTTPException(status_code=503, detail=str(error)) from error
	except httpx.HTTPError as error:
		raise HTTPException(status_code=502, detail='Solana RPC unavailable') from error
