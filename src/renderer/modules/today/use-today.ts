import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useEffect } from 'react';

import type { Channel, ChannelOutput } from '@shared/ipc/contract';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { call } from '../../lib/ipc';
import { useUiStore } from '../../stores/ui-store';

export function useEnabledModules(): Set<string> {
	const modules = useQuery({
		queryKey: ['modules', 'list'],
		queryFn: () => call('modules:list'),
	});
	return new Set((modules.data ?? []).filter((m) => m.enabled).map((m) => m.id));
}

/**
 * One source for a card: only fetched when its module is on, refreshed every minute while the
 * Hub is on screen. Other panels share the same query keys where they already exist.
 */
export function useSource<C extends Channel>(
	key: readonly unknown[],
	enabled: boolean,
	fetch: () => Promise<ChannelOutput<C>>,
	sidecar = false,
): UseQueryResult<ChannelOutput<C>> {
	const visible = useUiStore((s) => s.room === 'hub');
	const query = useQuery({
		queryKey: key,
		queryFn: fetch,
		enabled,
		retry: false,
		staleTime: 30_000,
		refetchInterval: visible ? 60_000 : false,
		...(sidecar ? { meta: SIDECAR_META } : {}),
	});
	// The Hub stays mounted in the background: coming back to it should show now, not then.
	const { refetch } = query;
	useEffect(() => {
		if (visible && enabled) void refetch();
	}, [visible, enabled, refetch]);
	return query;
}
