import json
import secrets

from starlette.types import ASGIApp, Receive, Scope, Send


def token_matches(authorization: str | None, expected: bytes) -> bool:
	scheme, _, supplied = (authorization or '').partition(' ')
	# compare_digest avoids leaking the token through timing differences.
	return scheme.lower() == 'bearer' and secrets.compare_digest(supplied.encode('utf-8'), expected)


class TokenAuthMiddleware:
	"""
	Rejects every HTTP and WebSocket request without the per-launch bearer token — before
	routing, so unknown paths can't be used to probe the server either.
	"""

	def __init__(self, app: ASGIApp, token: str) -> None:
		self.app = app
		self.expected = token.encode('utf-8')

	async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
		if scope['type'] not in ('http', 'websocket'):
			await self.app(scope, receive, send)
			return

		headers = {k.decode('latin-1').lower(): v.decode('latin-1') for k, v in scope['headers']}
		if token_matches(headers.get('authorization'), self.expected):
			await self.app(scope, receive, send)
			return

		if scope['type'] == 'websocket':
			# 1008 = policy violation; closing before accept rejects the handshake.
			await send({'type': 'websocket.close', 'code': 1008})
			return

		body = json.dumps({'detail': 'Missing or invalid token'}).encode('utf-8')
		await send(
			{
				'type': 'http.response.start',
				'status': 401,
				'headers': [
					(b'content-type', b'application/json'),
					(b'content-length', str(len(body)).encode('ascii')),
					(b'www-authenticate', b'Bearer'),
				],
			}
		)
		await send({'type': 'http.response.body', 'body': body})
