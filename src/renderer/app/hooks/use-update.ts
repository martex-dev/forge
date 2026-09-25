import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';

import type { UpdateStatus } from '@shared/ipc/channels/update';

import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';

export const UPDATE_KEY = ['update', 'status'] as const;

/** Live update status: main pushes every change, so no polling. */
export function useUpdateStatus(): UseQueryResult<UpdateStatus> {
	const client = useQueryClient();
	useForgeEvent('update:changed', (status) => client.setQueryData(UPDATE_KEY, status));
	return useQuery({ queryKey: UPDATE_KEY, queryFn: () => call('update:status') });
}
