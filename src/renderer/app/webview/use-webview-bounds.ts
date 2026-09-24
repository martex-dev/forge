import { type RefObject, useEffect, useRef } from 'react';

import type { Bounds } from '@shared/ipc/channels/webview';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';

const POLL_MS = 200;

function measure(el: HTMLElement): Bounds {
	const r = el.getBoundingClientRect();
	return {
		x: Math.max(0, Math.round(r.left)),
		y: Math.max(0, Math.round(r.top)),
		width: Math.max(0, Math.round(r.width)),
		height: Math.max(0, Math.round(r.height)),
	};
}

const same = (a: Bounds | null, b: Bounds): boolean =>
	!!a && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;

/**
 * Keeps the native view glued to `ref`'s rectangle. ResizeObserver catches size changes; a
 * light poll catches pure moves (docking a panel elsewhere can move it without resizing).
 */
export function useWebviewBounds(
	instanceId: string,
	ref: RefObject<HTMLElement | null>,
	wantVisible: boolean,
	attached: boolean,
): void {
	const last = useRef<{ bounds: Bounds | null; visible: boolean }>({
		bounds: null,
		visible: false,
	});

	useEffect(() => {
		const el = ref.current;
		if (!el || !attached) return;

		const sync = (): void => {
			const bounds = measure(el);
			// A hidden dockview tab collapses to 0×0; treat that as not visible.
			const visible = wantVisible && bounds.width > 0 && bounds.height > 0;
			if (same(last.current.bounds, bounds) && last.current.visible === visible) return;
			last.current = { bounds, visible };
			call('webview:setBounds', { instanceId, bounds, visible }).catch((error: unknown) =>
				rlog.warn('webview', 'setBounds failed', error),
			);
		};

		sync();
		const observer = new ResizeObserver(sync);
		observer.observe(el);
		window.addEventListener('resize', sync);
		const timer = setInterval(sync, POLL_MS);
		return () => {
			observer.disconnect();
			window.removeEventListener('resize', sync);
			clearInterval(timer);
		};
	}, [instanceId, ref, wantVisible, attached]);

	// Hide immediately when visibility drops (e.g. palette opened) instead of waiting for a tick.
	useEffect(() => {
		const bounds = last.current.bounds;
		if (!attached || wantVisible || !bounds) return;
		last.current = { bounds, visible: false };
		call('webview:setBounds', { instanceId, bounds, visible: false }).catch((error: unknown) =>
			rlog.warn('webview', 'hide failed', error),
		);
	}, [instanceId, wantVisible, attached]);
}
