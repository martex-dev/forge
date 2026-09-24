import type { ModuleManifest } from './types';

// Auto-discovered: dropping a new `<id>.manifest.ts` next to this file registers it.
const found = import.meta.glob<ModuleManifest>('./*.manifest.ts', {
	import: 'manifest',
	eager: true,
});

export const MANIFESTS: readonly ModuleManifest[] = Object.values(found).sort((a, b) =>
	a.id.localeCompare(b.id),
);

export function getManifest(id: string): ModuleManifest | undefined {
	return MANIFESTS.find((m) => m.id === id);
}
