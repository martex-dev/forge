import { keepPreviousData, useQueries, useQuery, type UseQueryResult } from '@tanstack/react-query';
import { useMemo } from 'react';

import type {
	FrameColumn,
	FrameHistogram,
	FrameInfo,
	FrameQuery,
	FrameSummaryRow,
} from '@shared/ipc/channels/frames';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { call } from '../../lib/ipc';
import { BLOCK, blocksFor } from './frame-model';

export function useFrameInfo(path: string | null): UseQueryResult<FrameInfo> {
	return useQuery({
		queryKey: ['frames', 'info', path],
		queryFn: () => call('frames:open', path ?? ''),
		enabled: path !== null,
		meta: SIDECAR_META,
		retry: false,
		staleTime: Infinity,
	});
}

export interface Rows {
	total: number | null;
	columns: FrameColumn[] | null;
	/** Sparse: rows not loaded yet are missing. */
	row(index: number): unknown[] | undefined;
	error: Error | null;
	fetching: boolean;
}

/** Loads the BLOCK-sized pages that cover the visible range; totals come with every page. */
export function useRows(
	path: string,
	query: FrameQuery,
	range: { start: number; end: number },
	/** Bumped by Reload to refetch everything, since file contents can change under the view. */
	version: number,
): Rows {
	// Always include block 0: it carries the total and columns before anything is scrolled.
	const blocks = useMemo(() => [...new Set([0, ...blocksFor(range)])], [range]);
	const results = useQueries({
		queries: blocks.map((b) => ({
			queryKey: ['frames', 'rows', path, query, version, b],
			queryFn: () => call('frames:rows', { path, ...query, offset: b * BLOCK, limit: BLOCK }),
			meta: SIDECAR_META,
			retry: false,
			staleTime: Infinity,
			gcTime: 60_000,
			placeholderData: b === 0 ? keepPreviousData : undefined,
		})),
	});
	const first = results[0]?.data;
	return {
		total: first?.total ?? null,
		columns: first?.columns ?? null,
		row: (index) => {
			const i = blocks.indexOf(Math.floor(index / BLOCK));
			return results[i]?.data?.rows[index % BLOCK];
		},
		error: results.find((r) => r.error)?.error ?? null,
		fetching: results.some((r) => r.isFetching),
	};
}

export function useSummary(path: string, version: number): UseQueryResult<FrameSummaryRow[]> {
	return useQuery({
		queryKey: ['frames', 'summary', path, version],
		queryFn: () => call('frames:summary', path),
		meta: SIDECAR_META,
		retry: false,
		staleTime: Infinity,
	});
}

export function useHistogram(
	path: string,
	column: string | null,
	version: number,
): UseQueryResult<FrameHistogram> {
	return useQuery({
		queryKey: ['frames', 'histogram', path, column, version],
		queryFn: () => call('frames:histogram', { path, column: column ?? '', bins: 30 }),
		enabled: column !== null,
		meta: SIDECAR_META,
		retry: false,
		staleTime: Infinity,
	});
}
