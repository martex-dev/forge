import type { ModuleInfo } from '@shared/modules/types';
import type { RoomId } from '@shared/rooms';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { queryClient } from '../../lib/query-client';
import { panelsFor, RENDERER_MODULES } from '../../modules/registry';
import { toast } from '../../stores/toast-store';
import { MODULES_KEY } from '../hooks/use-modules';
import { applyDefaultLayout, getLayoutApi } from './layout-controller';

/** Deletes the saved layout and rebuilds the room from its enabled modules' default panels. */
export async function resetRoomLayout(room: RoomId): Promise<void> {
	try {
		await call('layouts:reset', room);
		const api = getLayoutApi(room);
		if (!api) return;
		const modules = queryClient.getQueryData<ModuleInfo[]>(MODULES_KEY) ?? [];
		const enabled = new Set(modules.filter((m) => m.enabled).map((m) => m.id));
		applyDefaultLayout(
			api,
			panelsFor(RENDERER_MODULES, enabled).filter((p) => p.room === room),
		);
		toast.success('Layout reset');
	} catch (error) {
		rlog.error('layout', `reset failed for ${room}`, error);
		toast.error('Could not reset layout', error instanceof Error ? error.message : undefined);
	}
}
