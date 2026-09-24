import { describe, expect, it, vi } from 'vitest';

import type { SidecarStatus } from '@shared/ipc/channels/sidecar';

import { backoffDelayMs } from './backoff';
import { type SidecarDeps, SidecarManager, type SidecarProcess } from './sidecar-manager';

class FakeProcess implements SidecarProcess {
	private exitListeners: Array<(code: number | null) => void> = [];
	constructor(readonly pid: number) {}
	onExit(listener: (code: number | null) => void): void {
		this.exitListeners.push(listener);
	}
	onOutput(): void {}
	crash(code = 1): void {
		for (const l of this.exitListeners) l(code);
	}
}

function setup(opts: { healthy?: (n: number) => boolean } = {}) {
	const processes: FakeProcess[] = [];
	const statuses: SidecarStatus[] = [];
	const envs: Array<Record<string, string>> = [];
	let pid = 100;
	const deps: SidecarDeps = {
		spawn: (env) => {
			envs.push(env);
			const p = new FakeProcess(pid++);
			processes.push(p);
			return p;
		},
		findPort: async () => 50_000 + processes.length,
		checkHealth: async () =>
			(opts.healthy ?? (() => true))(processes.length) ? { version: '0.1.0', python: '3.12.10' } : null,
		killTree: vi.fn(async () => undefined),
		sleep: async () => undefined,
		onStatus: (s) => statuses.push(s),
		onGaveUp: vi.fn(),
		log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
		startupTimeoutMs: 50,
		pollIntervalMs: 1,
	};
	return { manager: new SidecarManager(deps), deps, processes, statuses, envs };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('backoffDelayMs', () => {
	it('doubles from 1s and caps at 16s', () => {
		expect([1, 2, 3, 4, 5, 6].map((a) => backoffDelayMs(a))).toEqual([
			1000, 2000, 4000, 8000, 16000, 16000,
		]);
	});
});

describe('SidecarManager', () => {
	it('starts with a fresh port and 64-hex-char token, then reports ready', async () => {
		const { manager, statuses, envs } = setup();
		await manager.start();
		expect(statuses.map((s) => s.state)).toEqual(['starting', 'ready']);
		expect(manager.getStatus()).toMatchObject({ state: 'ready', version: '0.1.0' });
		expect(envs[0]?.['FORGE_TOKEN']).toMatch(/^[0-9a-f]{64}$/);
		expect(envs[0]?.['FORGE_PORT']).toBe('50000');
	});

	it('restarts after a crash (amber then green) with a new token', async () => {
		const { manager, processes, statuses, envs } = setup();
		await manager.start();
		processes[0]?.crash();
		await flush();
		await flush();
		expect(statuses.map((s) => s.state)).toEqual(['starting', 'ready', 'restarting', 'restarting', 'ready']);
		expect(processes).toHaveLength(2);
		expect(envs[1]?.['FORGE_TOKEN']).not.toBe(envs[0]?.['FORGE_TOKEN']);
	});

	it('gives up after 5 failed attempts and reports an error', async () => {
		const { manager, deps, statuses } = setup({ healthy: () => false });
		await manager.start();
		expect(manager.getStatus().state).toBe('error');
		expect(deps.onGaveUp).toHaveBeenCalledTimes(1);
		const attempts = statuses.filter((s) => s.state === 'restarting').map((s) => s.attempt);
		expect(Math.max(...attempts)).toBe(5);
		// Every timed-out process was killed as a tree.
		expect(deps.killTree).toHaveBeenCalledTimes(6);
	});

	it('stop() kills the process tree and ignores the resulting exit', async () => {
		const { manager, deps, processes, statuses } = setup();
		await manager.start();
		await manager.stop();
		processes[0]?.crash(0);
		await flush();
		expect(deps.killTree).toHaveBeenCalledWith(100);
		expect(statuses.at(-1)?.state).toBe('stopped');
		expect(processes).toHaveLength(1);
	});

	it('refuses requests unless ready', async () => {
		const { manager } = setup();
		await expect(manager.request('GET', '/health')).rejects.toMatchObject({
			code: 'SIDECAR_UNAVAILABLE',
		});
	});
});
