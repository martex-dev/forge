import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useRef, useState } from 'react';

import type { ProbeSetup, Run, RunDetail } from '@shared/ipc/channels/lab';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { useUiStore } from '../../stores/ui-store';
import { mergePoints, type Series, type SeriesState, toSeries } from './runs-model';

export const RUNS_KEY = ['runs', 'list'] as const;
const LIVE_MS = 1_000;
const IDLE_MS = 5_000;

export function useRuns(): {
	runs: Run[];
	isLoading: boolean;
	error: Error | null;
	refetch: () => void;
} {
	// Main watches runs for notifications, so the list only needs polling while it's on screen.
	const visible = useUiStore((s) => s.room === 'lab');
	const query = useQuery({
		queryKey: RUNS_KEY,
		queryFn: () => call('runs:list'),
		meta: SIDECAR_META,
		// Fast while something trains; a new run shows up within 10 s otherwise.
		refetchInterval: (q) =>
			!visible ? false : q.state.data?.some((r) => r.status === 'running') ? 2_000 : 10_000,
	});
	return {
		runs: query.data ?? [],
		isLoading: query.isLoading,
		error: query.error,
		refetch: () => void query.refetch(),
	};
}

export function useRunDetail(id: string, live: boolean): RunDetail | undefined {
	const query = useQuery({
		queryKey: ['runs', 'detail', id],
		queryFn: () => call('runs:get', id),
		meta: SIDECAR_META,
		refetchInterval: live ? 2_000 : false,
	});
	return query.data;
}

/**
 * Incremental metric stream for one run: fetches only points after the last cursor and merges
 * them. Mount with `key={runId}` so switching runs starts from a clean state.
 */
export function useRunMetrics(
	id: string,
	live: boolean,
): { series: Series; loaded: boolean; error: Error | null } {
	const [data, setData] = useState<SeriesState>(() => new Map());
	const [loaded, setLoaded] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const liveRef = useRef(live);
	useEffect(() => {
		liveRef.current = live;
	}, [live]);

	useEffect(() => {
		let cancelled = false;
		let cursor = 0;
		let timer: ReturnType<typeof setTimeout> | undefined;
		const tick = async (): Promise<void> => {
			try {
				const page = await call('runs:metrics', { id, after: cursor });
				if (cancelled) return;
				cursor = page.cursor;
				setData((prev) => mergePoints(prev, page.points));
				setError(null);
				if (page.more) {
					void tick();
					return;
				}
				setLoaded(true);
			} catch (e) {
				if (cancelled) return;
				setError(e instanceof Error ? e : new Error(String(e)));
			}
			// Finished runs are still polled slowly: an interrupted run resumes if its probe reconnects.
			const onScreen = useUiStore.getState().room === 'lab';
			if (!cancelled)
				timer = setTimeout(
					() => void tick(),
					liveRef.current && onScreen ? LIVE_MS : IDLE_MS,
				);
		};
		void tick();
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [id]);

	const series = useMemo(() => toSeries(data), [data]);
	return { series, loaded, error };
}

export function useDeleteRun(): (run: Run) => void {
	const client = useQueryClient();
	const mutation = useMutation({
		mutationFn: (run: Run) => call('runs:delete', run.id),
		onSuccess: (_void, run) => {
			client.setQueryData<Run[]>(RUNS_KEY, (list) => list?.filter((r) => r.id !== run.id));
			toast.success('Run deleted', run.name);
		},
		onError: (error) => toast.error('Could not delete run', error.message),
	});
	return mutation.mutate;
}

export function useProbeSetup(): ProbeSetup | undefined {
	return useQuery({ queryKey: ['runs', 'setup'], queryFn: () => call('runs:setup') }).data;
}
