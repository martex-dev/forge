import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { createInterface } from 'node:readline';

import { app } from 'electron';
import log from 'electron-log/main';
import { z } from 'zod';

import type { SidecarStatus } from '@shared/ipc/channels/sidecar';

import { emitEvent, router } from '../ipc';
import type { Notifier } from '../notify';
import { findFreePort, killTree } from './process-utils';
import { type HealthInfo, SidecarManager, type SidecarProcess } from './sidecar-manager';

const HealthSchema = z.object({ status: z.literal('ok'), version: z.string(), python: z.string() });
const slog = log.scope('sidecar');

function sidecarDir(): string {
	// TODO(phase-6): packaged builds run a PyInstaller binary from resources instead of uv.
	return join(app.getAppPath(), 'sidecar');
}

function spawnSidecar(env: Record<string, string>): SidecarProcess {
	const child = spawn('uv', ['run', '--project', sidecarDir(), 'python', '-m', 'forge_sidecar'], {
		cwd: sidecarDir(),
		env: { ...process.env, ...env },
		windowsHide: true,
		// On POSIX, a new process group lets killTree signal uv and python together.
		detached: process.platform !== 'win32',
		stdio: ['ignore', 'pipe', 'pipe'],
	});
	const exitListeners: Array<(code: number | null) => void> = [];
	let exited = false;
	const fireExit = (code: number | null): void => {
		if (exited) return;
		exited = true;
		for (const listener of exitListeners) listener(code);
	};
	child.on('exit', (code) => fireExit(code));
	child.on('error', (error) => {
		slog.error('failed to spawn uv — is it installed and on PATH?', error.message);
		fireExit(null);
	});

	return {
		pid: child.pid,
		onExit: (listener) => exitListeners.push(listener),
		onOutput: (listener) => {
			if (child.stdout) createInterface({ input: child.stdout }).on('line', (l) => listener(l, 'stdout'));
			if (child.stderr) createInterface({ input: child.stderr }).on('line', (l) => listener(l, 'stderr'));
		},
	};
}

async function checkHealth(baseUrl: string, token: string): Promise<HealthInfo | null> {
	try {
		const response = await fetch(`${baseUrl}/health`, {
			headers: { Authorization: `Bearer ${token}` },
			signal: AbortSignal.timeout(1500),
		});
		if (!response.ok) return null;
		const parsed = HealthSchema.safeParse(await response.json());
		return parsed.success ? { version: parsed.data.version, python: parsed.data.python } : null;
	} catch {
		// Not listening yet (or mid-restart): the caller keeps polling.
		return null;
	}
}

const DISABLED: SidecarStatus = { state: 'disabled', attempt: 0, message: 'FORGE_NO_SIDECAR=1' };

export function createSidecar(notify: Notifier): SidecarManager | null {
	const disabled = process.env['FORGE_NO_SIDECAR'] === '1';
	const manager = disabled
		? null
		: new SidecarManager({
				spawn: spawnSidecar,
				dataDir: join(app.getPath('userData'), 'sidecar'),
				findPort: findFreePort,
				checkHealth,
				killTree,
				sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
				onStatus: (status) => emitEvent('sidecar:status', status),
				onGaveUp: (message) =>
					notify({
						module: 'core',
						level: 'error',
						title: 'Python sidecar stopped',
						body: `${message}. Check the log, then run "Restart Python Sidecar".`,
					}),
				log: {
					info: (m, meta) => slog.info(m, meta ?? ''),
					warn: (m, meta) => slog.warn(m, meta ?? ''),
					error: (m, meta) => slog.error(m, meta ?? ''),
				},
			});

	router.handle('sidecar:getStatus', () => manager?.getStatus() ?? DISABLED);
	router.handle('sidecar:restart', async () => {
		if (!manager) return DISABLED;
		void manager.restart();
		return manager.getStatus();
	});
	return manager;
}
