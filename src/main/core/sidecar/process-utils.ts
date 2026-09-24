import { spawn } from 'node:child_process';
import { createServer } from 'node:net';

/** Asks the OS for a free port on loopback. */
export function findFreePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.unref();
		server.on('error', reject);
		server.listen(0, '127.0.0.1', () => {
			const address = server.address();
			const port = typeof address === 'object' && address ? address.port : 0;
			server.close(() => (port ? resolve(port) : reject(new Error('No port assigned'))));
		});
	});
}

/**
 * Kills a process and all its children. `uv run` starts python as a child, so killing only the
 * direct child would orphan python.exe on Windows.
 */
export function killTree(pid: number): Promise<void> {
	return new Promise((resolve) => {
		if (process.platform === 'win32') {
			const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], {
				windowsHide: true,
				stdio: 'ignore',
			});
			killer.on('exit', () => resolve());
			killer.on('error', () => resolve());
			return;
		}
		try {
			// Spawned with detached: true, so the negative pid addresses the whole group.
			process.kill(-pid, 'SIGTERM');
		} catch {
			// Already gone.
		}
		resolve();
	});
}
