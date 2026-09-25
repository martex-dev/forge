import {
	useMutation,
	type UseMutationResult,
	useQuery,
	useQueryClient,
	type UseQueryResult,
} from '@tanstack/react-query';

import type { EarningsRange, EarningsSettings } from '@shared/ipc/channels/earnings';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';
import { toast } from '../../stores/toast-store';

type SettingsWithKey = EarningsSettings & { hasFinnhubKey: boolean };
const SETTINGS_KEY = ['earnings', 'settings'] as const;

export function useEarningsSettings(): UseQueryResult<SettingsWithKey> {
	const client = useQueryClient();
	useForgeEvent('secrets:changed', ({ key }) => {
		if (key !== 'finnhub.key') return;
		void client.invalidateQueries({ queryKey: SETTINGS_KEY });
		void client.invalidateQueries({ queryKey: ['earnings', 'range'] });
	});
	return useQuery({ queryKey: SETTINGS_KEY, queryFn: () => call('earnings:settings') });
}

export function useSaveEarningsSettings(): UseMutationResult<
	SettingsWithKey,
	Error,
	EarningsSettings
> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (s: EarningsSettings) => call('earnings:setSettings', s),
		onSuccess: (s) => {
			client.setQueryData(SETTINGS_KEY, s);
			// A different source means different rows for the same week.
			void client.invalidateQueries({ queryKey: ['earnings', 'range'] });
		},
		onError: (e) => toast.error('Could not save earnings settings', e.message),
	});
}

export function useEarnings(
	range: { start: string; end: string },
	settings: EarningsSettings | undefined,
	visible: boolean,
): UseQueryResult<EarningsRange> {
	return useQuery({
		queryKey: ['earnings', 'range', range.start, range.end, settings],
		queryFn: () => call('earnings:range', range),
		enabled: settings !== undefined,
		meta: SIDECAR_META,
		// The sidecar caches upcoming days for 6 h; hourly is plenty while on screen.
		staleTime: 30 * 60_000,
		refetchInterval: visible ? 60 * 60_000 : false,
		retry: 1,
	});
}
