import type { DockviewApi } from 'dockview-react';

import type { RoomId } from '@shared/rooms';

import type { OpenPanelOptions, PanelDefinition } from '../../modules/types';

/**
 * Bridges commands (which don't live inside React) to each room's dockview instance.
 * RoomLayout registers its api on ready.
 */
const apis = new Map<RoomId, DockviewApi>();

export function registerLayoutApi(room: RoomId, api: DockviewApi): () => void {
	apis.set(room, api);
	return () => {
		if (apis.get(room) === api) apis.delete(room);
	};
}

export function getLayoutApi(room: RoomId): DockviewApi | undefined {
	return apis.get(room);
}

export function openPanelIn(
	api: DockviewApi,
	def: PanelDefinition,
	options: OpenPanelOptions = {},
): void {
	const instanceId = options.instanceId ?? def.id;
	const existing = api.getPanel(instanceId);
	if (existing) {
		existing.api.setActive();
		return;
	}
	// Direction is relative to the whole grid; the first panel just fills the room.
	const direction = def.position && def.position !== 'tab' ? def.position : null;
	const horizontal = direction === 'left' || direction === 'right';
	api.addPanel({
		id: instanceId,
		component: def.id,
		title: options.title ?? def.title,
		params: { ...options.params, room: def.room },
		...(def.renderer ? { renderer: def.renderer } : {}),
		...(direction && api.panels.length > 0 ? { position: { direction } } : {}),
		...(direction && def.initialSize
			? horizontal
				? { initialWidth: def.initialSize }
				: { initialHeight: def.initialSize }
			: {}),
	});
}

/** Next free `<definitionId>#<n>` for multi-instance panels. */
export function nextInstanceId(api: DockviewApi, definitionId: string): string {
	const taken = new Set(api.panels.map((p) => p.id));
	for (let n = 1; ; n++) {
		const id = `${definitionId}#${n}`;
		if (!taken.has(id)) return id;
	}
}

/** Clears the room and opens every default panel of its enabled modules. */
export function applyDefaultLayout(api: DockviewApi, panels: readonly PanelDefinition[]): void {
	api.clear();
	for (const def of panels) {
		if (def.defaultOpen) openPanelIn(api, def);
	}
}

/**
 * Panel instance ids are `<definitionId>` or, for multi-instance panels such as terminals,
 * `<definitionId>#<n>`. This recovers the definition id.
 */
export function definitionIdOf(panelId: string): string {
	const hash = panelId.indexOf('#');
	return hash === -1 ? panelId : panelId.slice(0, hash);
}

/** Closes panels whose module is no longer enabled. */
export function pruneDisabledPanels(api: DockviewApi, enabledPanelIds: ReadonlySet<string>): void {
	for (const panel of [...api.panels]) {
		if (!enabledPanelIds.has(definitionIdOf(panel.id))) panel.api.close();
	}
}
