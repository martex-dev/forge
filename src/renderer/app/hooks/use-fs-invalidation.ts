import { useQueryClient } from '@tanstack/react-query';

import { useForgeEvent } from '../../lib/use-forge-event';

export const fsKeys = {
	all: ['fs'] as const,
	list: (dir: string) => ['fs', 'list', dir] as const,
	file: (path: string) => ['fs', 'file', path] as const,
};

/** Mounted once by the shell: turns watcher batches into cache invalidations for every module. */
export function useFsInvalidation(): void {
	const client = useQueryClient();
	useForgeEvent('fs:changed', ({ dirs, files }) => {
		for (const dir of dirs) void client.invalidateQueries({ queryKey: fsKeys.list(dir) });
		for (const file of files) void client.invalidateQueries({ queryKey: fsKeys.file(file) });
	});
}
