import { useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';

import type { RunDetail, RunSeries, RunSummary } from '@shared/ipc/channels/lab';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { call } from '../../lib/ipc';

const MAX_POINTS = 1500;

export function useCompareDetails(ids: readonly string[]): Array<RunDetail | undefined> {
	return useQueries({
		queries: ids.map((id) => ({
			queryKey: ['runs', 'detail', id],
			queryFn: () => call('runs:get', id),
			meta: SIDECAR_META,
		})),
		// combine keeps the array identity stable while nothing changed (charts memoize on it).
		combine: (results) => results.map((q) => q.data),
	});
}

export function useCompareSummary(
	ids: readonly string[],
	live: boolean,
): UseQueryResult<RunSummary[]> {
	return useQuery({
		queryKey: ['runs', 'summary', ids],
		queryFn: () => call('runs:summary', [...ids]),
		enabled: ids.length > 0,
		meta: SIDECAR_META,
		refetchInterval: live ? 5_000 : false,
	});
}

/** Thinned series per run; runs still training refresh every 5 s. */
export function useCompareSeries(
	ids: readonly string[],
	liveIds: ReadonlySet<string>,
): Array<RunSeries | undefined> {
	return useQueries({
		queries: ids.map((id) => ({
			queryKey: ['runs', 'series', id],
			queryFn: () => call('runs:series', { id, maxPoints: MAX_POINTS }),
			meta: SIDECAR_META,
			refetchInterval: liveIds.has(id) ? 5_000 : (false as const),
		})),
		combine: (results) => results.map((q) => q.data),
	});
}
