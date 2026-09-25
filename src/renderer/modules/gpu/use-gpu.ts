import { useQuery } from '@tanstack/react-query';
import { create } from 'zustand';

import type { GpuSnapshot } from '@shared/ipc/channels/lab';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { call } from '../../lib/ipc';
import { type GpuHistory, pushSample } from './gpu-model';

const POLL_MS = 2_000;

/** Rolling history, filled by every poll (panel or status bar) so the sparkline has context. */
export const useGpuHistory = create<{ history: GpuHistory }>(() => ({ history: {} }));

export function useGpu(): {
	snapshot: GpuSnapshot | undefined;
	isLoading: boolean;
	error: Error | null;
	refetch: () => void;
} {
	const query = useQuery({
		queryKey: ['gpu', 'snapshot'],
		queryFn: async () => {
			const snapshot = await call('gpu:snapshot');
			useGpuHistory.setState((s) => ({
				history: pushSample(s.history, snapshot, Date.now()),
			}));
			return snapshot;
		},
		meta: SIDECAR_META,
		refetchInterval: POLL_MS,
		staleTime: POLL_MS / 2,
	});
	return {
		snapshot: query.data,
		isLoading: query.isLoading,
		error: query.error,
		refetch: () => void query.refetch(),
	};
}
