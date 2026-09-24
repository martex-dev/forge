import {
	type DockviewApi,
	DockviewReact,
	type DockviewReadyEvent,
	type SerializedDockview,
} from 'dockview-react';
import { type JSX, useCallback, useEffect, useMemo, useRef } from 'react';

import type { RoomId } from '@shared/rooms';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import type { PanelDefinition } from '../../modules/types';
import { useOverlayStore } from '../../stores/overlay-store';
import { toast } from '../../stores/toast-store';
import {
	applyDefaultLayout,
	openPanelIn,
	pruneDisabledPanels,
	registerLayoutApi,
} from './layout-controller';
import { LayoutWatermark } from './LayoutWatermark';
import { PANEL_COMPONENTS } from './panel-components';

import 'dockview-react/dist/styles/dockview.css';
import '../../styles/dockview-theme.css';

const THEME = { name: 'forge', className: 'dockview-theme-forge', gap: 0 };
const SAVE_DEBOUNCE_MS = 400;

interface RoomLayoutProps {
	room: RoomId;
	active: boolean;
	/** Panels of this room contributed by currently enabled modules. */
	panels: readonly PanelDefinition[];
}

/** One dockview per room. All rooms stay mounted so panel state (e.g. terminals) survives switching. */
export function RoomLayout({ room, active, panels }: RoomLayoutProps): JSX.Element {
	const apiRef = useRef<DockviewApi | null>(null);
	const readyRef = useRef(false);
	const cleanupRef = useRef<(() => void) | null>(null);
	const panelsRef = useRef(panels);
	const prevEnabledRef = useRef(new Set(panels.map((p) => p.id)));
	const enabledIds = useMemo(() => new Set(panels.map((p) => p.id)), [panels]);

	useEffect(() => {
		panelsRef.current = panels;
	}, [panels]);

	const onReady = useCallback(
		(event: DockviewReadyEvent) => {
			const api = event.api;
			apiRef.current = api;
			const unregister = registerLayoutApi(room, api);

			let timer: ReturnType<typeof setTimeout> | undefined;
			const persist = (): void => {
				if (!readyRef.current) return;
				clearTimeout(timer);
				timer = setTimeout(() => {
					call('layouts:save', {
						room,
						layout: api.toJSON() as unknown as Record<string, unknown>,
					}).catch((error: unknown) =>
						rlog.warn('layout', `save failed for ${room}`, error),
					);
				}, SAVE_DEBOUNCE_MS);
			};
			const sub = api.onDidLayoutChange(persist);

			// Native webviews would cover dockview's drop targets, so a drag counts as an overlay.
			const dragId = `dock-drag-${room}`;
			const endDrag = (): void => useOverlayStore.getState().remove(dragId);
			const dragSubs = [
				api.onWillDragPanel(() => useOverlayStore.getState().add(dragId)),
				api.onWillDragGroup(() => useOverlayStore.getState().add(dragId)),
				api.onDidDrop(endDrag),
			];
			window.addEventListener('dragend', endDrag, true);
			window.addEventListener('drop', endDrag, true);

			void (async () => {
				try {
					const saved = await call('layouts:get', room);
					if (saved && typeof saved === 'object') {
						api.fromJSON(saved as SerializedDockview);
					} else {
						applyDefaultLayout(api, panelsRef.current);
					}
				} catch (error) {
					rlog.warn('layout', `restore failed for ${room}, using default`, error);
					toast.warn(
						`Couldn't restore the ${room} layout`,
						'Falling back to the default layout.',
					);
					applyDefaultLayout(api, panelsRef.current);
				}
				pruneDisabledPanels(api, new Set(panelsRef.current.map((p) => p.id)));
				readyRef.current = true;
			})();

			// dockview ignores onReady's return value, so teardown goes through a ref.
			cleanupRef.current = () => {
				clearTimeout(timer);
				sub.dispose();
				for (const d of dragSubs) d.dispose();
				window.removeEventListener('dragend', endDrag, true);
				window.removeEventListener('drop', endDrag, true);
				endDrag();
				unregister();
			};
		},
		[room],
	);

	useEffect(() => () => cleanupRef.current?.(), []);

	// React to modules being enabled/disabled while the app runs.
	useEffect(() => {
		const api = apiRef.current;
		if (!api || !readyRef.current) return;
		pruneDisabledPanels(api, enabledIds);
		for (const def of panels) {
			if (def.defaultOpen && !prevEnabledRef.current.has(def.id)) openPanelIn(api, def);
		}
		prevEnabledRef.current = new Set(enabledIds);
	}, [enabledIds, panels]);

	return (
		<div
			className={active ? 'absolute inset-0' : 'invisible absolute inset-0'}
			aria-hidden={!active}
			inert={!active}
			data-room-layout={room}
		>
			<DockviewReact
				components={PANEL_COMPONENTS}
				watermarkComponent={LayoutWatermark}
				onReady={onReady}
				theme={THEME}
				className='h-full'
			/>
		</div>
	);
}
