import type { DockviewApi } from 'dockview-react';

import type { RoomId } from '@shared/rooms';

import type { PanelDefinition } from '../../modules/types';

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

export function openPanelIn(api: DockviewApi, def: PanelDefinition): void {
	const existing = api.getPanel(def.id);
	if (existing) {
		existing.api.setActive();
		return;
	}
	api.addPanel({ id: def.id, component: def.id, title: def.title, params: { room: def.room } });
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
