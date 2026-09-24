import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';

import type { ModuleInfo } from '@shared/modules/types';

import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';

export const MODULES_KEY = ['modules'] as const;

export interface ModulesState {
	modules: ModuleInfo[];
	enabled: ReadonlySet<string>;
	isLoading: boolean;
	error: Error | null;
	refetch: () => Promise<unknown>;
}

/** Module list from main, kept live via the `modules:changed` event. */
export function useModules(): ModulesState {
	const client = useQueryClient();
	const query = useQuery({ queryKey: MODULES_KEY, queryFn: () => call('modules:list') });
	useForgeEvent('modules:changed', (list) => client.setQueryData(MODULES_KEY, list));

	const modules = useMemo(() => query.data ?? [], [query.data]);
	const enabled = useMemo(
		() => new Set(modules.filter((m) => m.enabled).map((m) => m.id)),
		[modules],
	);
	return {
		modules,
		enabled,
		isLoading: query.isLoading,
		error: query.error,
		refetch: query.refetch,
	};
}
