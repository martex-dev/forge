import { useQuery, useQueryClient } from '@tanstack/react-query';

import type { WorkspaceInfo } from '@shared/ipc/channels/workspace';

import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';

export const WORKSPACE_KEY = ['workspace'] as const;

const EMPTY: WorkspaceInfo = { root: null, name: null, recent: [] };

/** The open folder, kept live via `workspace:changed`. */
export function useWorkspace(): { info: WorkspaceInfo; isLoading: boolean; error: Error | null } {
	const client = useQueryClient();
	const query = useQuery({ queryKey: WORKSPACE_KEY, queryFn: () => call('workspace:get') });
	useForgeEvent('workspace:changed', (info) => {
		client.setQueryData(WORKSPACE_KEY, info);
		// Every cached listing/file belongs to the previous folder now; drop them outright.
		client.removeQueries({ queryKey: ['fs'] });
	});
	return { info: query.data ?? EMPTY, isLoading: query.isLoading, error: query.error };
}
