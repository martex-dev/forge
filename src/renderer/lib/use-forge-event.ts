import { useEffect, useRef } from 'react';

import type { EventPayload, ForgeEvent } from '@shared/ipc/contract';

/** Subscribes to a main → renderer event for the lifetime of the component. */
export function useForgeEvent<E extends ForgeEvent>(
	event: E,
	handler: (payload: EventPayload<E>) => void,
): void {
	const ref = useRef(handler);
	useEffect(() => {
		ref.current = handler;
	});
	useEffect(() => window.forge.on(event, (payload) => ref.current(payload)), [event]);
}
