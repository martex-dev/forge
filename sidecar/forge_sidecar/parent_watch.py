import asyncio
import logging
import os
import sys

import uvicorn

logger = logging.getLogger('forge_sidecar')


def is_process_alive(pid: int) -> bool:
	if sys.platform == 'win32':
		import ctypes

		process_query_limited_information = 0x1000
		still_active = 259
		kernel32 = ctypes.windll.kernel32
		handle = kernel32.OpenProcess(process_query_limited_information, False, pid)
		if not handle:
			return False
		try:
			code = ctypes.c_ulong()
			if not kernel32.GetExitCodeProcess(handle, ctypes.byref(code)):
				return False
			return code.value == still_active
		finally:
			kernel32.CloseHandle(handle)
	try:
		os.kill(pid, 0)
	except OSError:
		return False
	return True


async def watch_parent(pid: int, server: uvicorn.Server, interval: float = 2.0) -> None:
	"""Exits when Forge main dies, so a crashed app never leaves an orphaned sidecar behind."""
	while not server.should_exit:
		if not is_process_alive(pid):
			logger.warning('parent process %s is gone; shutting down', pid)
			server.should_exit = True
			return
		await asyncio.sleep(interval)
