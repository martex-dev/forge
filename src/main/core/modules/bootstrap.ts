import log from 'electron-log/main';

import { MANIFESTS } from '@shared/modules';
import { ModuleTogglesSchema } from '@shared/settings';

import type { SettingsRepo } from '../db/settings-repo';
import { emitEvent, router } from '../ipc';
import { ModuleRegistry } from './registry';
import type { MainModule } from './types';

// Main-side module implementations are discovered from src/main/modules/<id>/index.ts.
const found = import.meta.glob<MainModule>('../../modules/*/index.ts', {
	import: 'mainModule',
	eager: true,
});

export function createModuleRegistry(settings: SettingsRepo): ModuleRegistry {
	const mainModules = new Map(Object.values(found).map((m) => [m.manifest.id, m]));

	const registry = new ModuleRegistry({
		manifests: MANIFESTS,
		mainModules,
		platform: process.platform,
		getToggles: () => settings.get('modules', ModuleTogglesSchema, {}),
		setToggles: (toggles) => settings.set('modules', ModuleTogglesSchema, toggles),
		createContext: (manifest, disposers) => {
			const scope = log.scope(manifest.id);
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
