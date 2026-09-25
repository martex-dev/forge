import asyncio
import time
from collections.abc import Callable


class TokenBucket:
	"""
	Async rate limiter: `capacity` requests, refilled at `rate_per_sec`. Callers wait instead of
	getting rate-limited (and eventually banned) by public APIs like DexScreener.
	"""

	def __init__(
		self,
		capacity: int,
		rate_per_sec: float,
		clock: Callable[[], float] = time.monotonic,
	) -> None:
		self.capacity = capacity
		self.rate = rate_per_sec
		self.clock = clock
		self.tokens = float(capacity)
		self.updated = clock()
		self._lock = asyncio.Lock()

	def _refill(self) -> None:
		now = self.clock()
		self.tokens = min(self.capacity, self.tokens + (now - self.updated) * self.rate)
		self.updated = now

	async def acquire(self) -> None:
		async with self._lock:
			self._refill()
			if self.tokens < 1:
				await asyncio.sleep((1 - self.tokens) / self.rate)
				self._refill()
			self.tokens -= 1
