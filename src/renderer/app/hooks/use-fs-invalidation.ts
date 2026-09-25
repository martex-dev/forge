import { useQueryClient } from '@tanstack/react-query';

import { useForgeEvent } from '../../lib/use-forge-event';
import { WORKSPACE_KEY } from './use-workspace';

export const fsKeys = {
	all: ['fs'] as const,
	list: (dir: string) => ['fs', 'list', dir] as const,
	file: (path: string) => ['fs', 'file', path] as const,
};

/**
 * Mounted once by the shell. Keeps every module's file caches in sync with main:
 * - a new folder drops all cached listings *before* the new root is published, so nothing
 *   ever mixes two folders (or deletes the new folder's in-flight queries);
 * - watcher batches invalidate exactly the directories/files that changed.
 */
export function useFsInvalidation(): void {
	const client = useQueryClient();
	useForgeEvent('workspace:changed', (info) => {
		client.removeQueries({ queryKey: fsKeys.all });
		client.setQueryData(WORKSPACE_KEY, info);
	});
	useForgeEvent('fs:changed', ({ dirs, files }) => {
		for (const dir of dirs) void client.invalidateQueries({ queryKey: fsKeys.list(dir) });
		for (const file of files) void client.invalidateQueries({ queryKey: fsKeys.file(file) });
	});
}
