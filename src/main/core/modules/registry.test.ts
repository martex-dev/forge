import { describe, expect, it, vi } from 'vitest';

import { defineManifest, type ModuleManifest } from '@shared/modules/types';

import { ModuleRegistry, type RegistryDeps } from './registry';
import type { MainModule } from './types';

const always = defineManifest({
	id: 'a',
	name: 'A',
	description: '',
	room: 'build',
	defaultEnabled: true,
});
const optIn = defineManifest({
	id: 'b',
	name: 'B',
	description: '',
	room: 'trade',
	defaultEnabled: false,
});
const winOnly = defineManifest({
	id: 'mt5',
	name: 'MT5',
	description: '',
	room: 'trade',
	platforms: ['win32'],
	defaultEnabled: true,
});

function setup(platform = 'win32', manifests: ModuleManifest[] = [always, optIn, winOnly]) {
	let toggles: Record<string, boolean> = {};
	const handlerOff = vi.fn();
	const deactivate = vi.fn();
	const activate = vi.fn((ctx: Parameters<MainModule['activate']>[0]) => {
		ctx.onDispose(handlerOff);
	});
	const mainModules = new Map<string, MainModule>(
		manifests.map((manifest) => [manifest.id, { manifest, activate, deactivate }]),
	);
	const deps: RegistryDeps = {
		manifests,
		mainModules,
		platform,
		getToggles: () => toggles,
		setToggles: (t) => {
			toggles = t;
		},
		createContext: (manifest, disposers) => ({
			manifest,
			log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
			ipc: { handle: vi.fn() },
			emit: vi.fn(),
			onDispose: (fn) => disposers.push(fn),
			notify: vi.fn(),
			getSecret: vi.fn(() => null),
			sidecar: vi.fn(),
			workspace: { root: () => null, onChange: vi.fn() },
		}),
		onError: vi.fn(),
	};
	return { registry: new ModuleRegistry(deps), activate, deactivate, handlerOff, deps };
}

describe('ModuleRegistry', () => {
	it('activates only default-enabled, supported modules on start', async () => {
		const { registry } = setup('win32');
		await registry.start();
		expect(registry.isActive('a')).toBe(true);
		expect(registry.isActive('b')).toBe(false);
		expect(registry.isActive('mt5')).toBe(true);
	});

	it('skips modules whose platforms exclude the current OS', async () => {
		const { registry } = setup('linux');
		await registry.start();
		expect(registry.isActive('mt5')).toBe(false);
		expect(registry.list().find((m) => m.id === 'mt5')).toMatchObject({
			supported: false,
			enabled: false,
		});
	});

	it('disabling a module deactivates it and runs its disposers, live', async () => {
		const { registry, deactivate, handlerOff } = setup();
		await registry.start();
		const list = await registry.setEnabled('a', false);
		expect(registry.isActive('a')).toBe(false);
		expect(deactivate).toHaveBeenCalledTimes(1);
		expect(handlerOff).toHaveBeenCalled();
		expect(list.find((m) => m.id === 'a')?.enabled).toBe(false);
	});

	it('enabling an opt-in module activates it and persists the toggle', async () => {
		const { registry, deps } = setup();
		await registry.start();
		await registry.setEnabled('b', true);
		expect(registry.isActive('b')).toBe(true);
		expect(deps.getToggles()).toEqual({ b: true });
	});

	it('cannot enable a module on an unsupported platform', async () => {
		const { registry } = setup('darwin');
		await registry.start();
		await registry.setEnabled('mt5', true);
		expect(registry.isActive('mt5')).toBe(false);
	});

	it('reports activation failures and leaves the module inactive', async () => {
		const { registry, deps, activate } = setup();
		activate.mockImplementationOnce(() => {
			throw new Error('no api key');
		});
		await registry.start();
		expect(deps.onError).toHaveBeenCalledWith('a', 'activate', expect.any(Error));
		expect(registry.isActive('a')).toBe(false);
	});

	it('throws for unknown modules', async () => {
		const { registry } = setup();
		await expect(registry.setEnabled('nope', true)).rejects.toThrow(/Unknown module/);
	});
});
