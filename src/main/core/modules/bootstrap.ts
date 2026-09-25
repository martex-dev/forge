import log from 'electron-log/main';

import { MANIFESTS } from '@shared/modules';
import { ModuleTogglesSchema } from '@shared/settings';

import type { SettingsRepo } from '../db/settings-repo';
import { ForgeError } from '../errors';
import { emitEvent, router } from '../ipc';
import type { Notifier } from '../notify';
import type { SecretsService } from '../secrets/secrets-service';
import type { SidecarManager } from '../sidecar/sidecar-manager';
import type { WorkspaceService } from '../workspace/workspace-service';
import { ModuleRegistry } from './registry';
import type { MainModule } from './types';

// Main-side module implementations are discovered from src/main/modules/<id>/index.ts.
const found = import.meta.glob<MainModule>('../../modules/*/index.ts', {
	import: 'mainModule',
	eager: true,
});

export interface CoreServices {
	settings: SettingsRepo;
	secrets: SecretsService;
	notify: Notifier;
	sidecar: SidecarManager | null;
	workspace: WorkspaceService;
}

export function createModuleRegistry(services: CoreServices): ModuleRegistry {
	const { settings, secrets, notify, sidecar, workspace } = services;
	const mainModules = new Map(Object.values(found).map((m) => [m.manifest.id, m]));

	const registry = new ModuleRegistry({
		manifests: MANIFESTS,
		mainModules,
		platform: process.platform,
		getToggles: () => settings.get('modules', ModuleTogglesSchema, {}),
		setToggles: (toggles) => settings.set('modules', ModuleTogglesSchema, toggles),
		createContext: (manifest, disposers) => {
			const scope = log.scope(manifest.id);
			const declared = new Set((manifest.requiredSecrets ?? []).map((s) => s.key));
			return {
				manifest,
				log: {
					info: (m, meta) => scope.info(m, meta ?? ''),
					warn: (m, meta) => scope.warn(m, meta ?? ''),
					error: (m, meta) => scope.error(m, meta ?? ''),
				},
				ipc: {
					handle: (channel, handler) => disposers.push(router.handle(channel, handler)),
				},
				emit: emitEvent,
				onDispose: (fn) => disposers.push(fn),
				notify: (input) => {
					notify({ ...input, module: manifest.id });
				},
				getSecret: (key) => {
					// A module may only read secrets it declared, so one module can't read another's keys.
					if (!declared.has(key)) {
						throw new ForgeError(
							'SECRET_NOT_DECLARED',
							`${manifest.id} did not declare "${key}"`,
						);
					}
					return secrets.get(key);
				},
				settings: {
					get: (key, schema, fallback) =>
						settings.get(`${manifest.id}:${key}`, schema, fallback),
					set: (key, schema, value) =>
						settings.set(`${manifest.id}:${key}`, schema, value),
				},
				workspace: {
					root: () => workspace.getRoot(),
					onChange: (listener) =>
						disposers.push(workspace.onChange((info) => listener(info.root))),
				},
				sidecar: (method, path, body, headers) => {
					if (!sidecar) {
						return Promise.reject(
							new ForgeError('SIDECAR_UNAVAILABLE', 'Sidecar is disabled'),
						);
					}
					return sidecar.request(method, path, body, headers);
				},
			};
		},
		onError: (id, phase, error) =>
			log.error(
				`[modules] ${id} failed to ${phase}`,
				error instanceof Error ? error.stack : error,
			),
	});

	router.handle('modules:list', () => registry.list());
	router.handle('modules:setEnabled', async ({ id, enabled }) => {
		const list = await registry.setEnabled(id, enabled);
		emitEvent('modules:changed', list);
		return list;
	});

	return registry;
}
