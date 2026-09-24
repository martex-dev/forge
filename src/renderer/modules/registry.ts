import type { CommandDefinition, PanelDefinition, RendererModule } from './types';

// Every folder src/renderer/modules/<id>/ with an index.ts(x) exporting `rendererModule` is picked up.
const found = import.meta.glob<RendererModule>('./*/index.{ts,tsx}', {
	import: 'rendererModule',
	eager: true,
});

export const RENDERER_MODULES: readonly RendererModule[] = Object.values(found).sort((a, b) =>
	a.manifest.id.localeCompare(b.manifest.id),
);

/** All panels, enabled or not; dockview must know every component to restore saved layouts. */
export const ALL_PANELS: readonly PanelDefinition[] = RENDERER_MODULES.flatMap(
	(m) => m.panels ?? [],
);

export function panelsFor(
	modules: readonly RendererModule[],
	enabled: ReadonlySet<string>,
): PanelDefinition[] {
	return modules.filter((m) => enabled.has(m.manifest.id)).flatMap((m) => m.panels ?? []);
}

export function commandsFor(
	modules: readonly RendererModule[],
	enabled: ReadonlySet<string>,
): CommandDefinition[] {
	return modules.filter((m) => enabled.has(m.manifest.id)).flatMap((m) => m.commands ?? []);
}
