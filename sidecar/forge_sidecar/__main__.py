import asyncio
import logging
import os
import sys

import uvicorn

from forge_sidecar.config import ConfigError, load_settings
from forge_sidecar.main import create_app
from forge_sidecar.parent_watch import watch_parent

logger = logging.getLogger('forge_sidecar')


def main() -> int:
	logging.basicConfig(
		level=logging.INFO,
		format='%(asctime)s %(levelname)s %(name)s: %(message)s',
		stream=sys.stderr,
	)
	try:
		settings = load_settings()
	except ConfigError as error:
		logger.error('config error: %s', error)
		return 2

	app = create_app(settings.token, data_dir=settings.data_dir, port=settings.port)
	config = uvicorn.Config(
		app,
		host='127.0.0.1',  # never 0.0.0.0: the sidecar must not be reachable from the network
		port=settings.port,
		log_level='warning',
		access_log=False,
	)
	server = uvicorn.Server(config)

	async def run() -> None:
		tasks = [asyncio.create_task(server.serve())]
		if settings.parent_pid:
			tasks.append(asyncio.create_task(watch_parent(settings.parent_pid, server)))
		await asyncio.gather(*tasks)

	logger.info('starting on 127.0.0.1:%s (pid %s)', settings.port, os.getpid())
	asyncio.run(run())
	return 0


if __name__ == '__main__':
	sys.exit(main())
