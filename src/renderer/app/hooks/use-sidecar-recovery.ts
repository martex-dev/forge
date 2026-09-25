import { useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';

import { useForgeEvent } from '../../lib/use-forge-event';

/** Mark a query with this meta when it depends on the Python sidecar. */
export const SIDECAR_META = { sidecar: true } as const;

/**
 * Mounted once by the shell. Panels often ask for data before the sidecar has finished
 * starting (or while it restarts); when it turns ready, refetch everything that needs it.
 */
export function useSidecarRecovery(): void {
	const client = useQueryClient();
	const lastState = useRef<string | null>(null);
	useForgeEvent('sidecar:status', ({ state }) => {
		if (state === 'ready' && lastState.current !== 'ready') {
			void client.invalidateQueries({ predicate: (q) => q.meta?.['sidecar'] === true });
		}
		lastState.current = state;
	});
}
