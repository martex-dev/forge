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

	def __init__(self, app: ASGIApp, token: str, scoped: dict[str, str] | None = None) -> None:
		self.app = app
		self.expected = token.encode('utf-8')
		# Extra tokens valid for exactly one path, e.g. the probe token for /probe/ws: training
		# scripts get to push metrics, not to call anything else.
		self.scoped = {path: t.encode('utf-8') for path, t in (scoped or {}).items()}

	async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
		if scope['type'] not in ('http', 'websocket'):
			await self.app(scope, receive, send)
			return

		headers = {k.decode('latin-1').lower(): v.decode('latin-1') for k, v in scope['headers']}
		authorization = headers.get('authorization')
		scoped = self.scoped.get(scope.get('path', ''))
		if token_matches(authorization, self.expected) or (
			scoped is not None and token_matches(authorization, scoped)
		):
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
