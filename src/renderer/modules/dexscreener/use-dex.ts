import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { DexPair, PairId, WatchEntry } from '@shared/ipc/channels/dex';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';
import { toast } from '../../stores/toast-store';

export const WATCHLIST_KEY = ['dex', 'watchlist'] as const;
export const QUOTES_KEY = ['dex', 'quotes'] as const;
const POLL_MS = 10_000;

export function useWatchlist(): { list: WatchEntry[]; isLoading: boolean; error: Error | null } {
	const client = useQueryClient();
	const query = useQuery({ queryKey: WATCHLIST_KEY, queryFn: () => call('dex:watchlist') });
	useForgeEvent('dex:watchlistChanged', (list) => {
		client.setQueryData(WATCHLIST_KEY, list);
		void client.invalidateQueries({ queryKey: QUOTES_KEY });
	});
	return { list: query.data ?? [], isLoading: query.isLoading, error: query.error };
}

export function useQuotes(enabled: boolean): {
	quotes: Map<string, DexPair>;
	isLoading: boolean;
	error: Error | null;
	updatedAt: number;
} {
	const query = useQuery({
		queryKey: QUOTES_KEY,
		queryFn: () => call('dex:quotes'),
		enabled,
		meta: SIDECAR_META,
		refetchInterval: POLL_MS,
		// Keep polling in the background: price flashes and alerts shouldn't stall.
		refetchIntervalInBackground: true,
		staleTime: POLL_MS / 2,
	});
	const quotes = new Map((query.data ?? []).map((p) => [pairKey(p), p]));
	return {
		quotes,
		isLoading: query.isLoading,
		error: query.error,
		updatedAt: query.dataUpdatedAt,
	};
}

export function usePair(id: PairId | null): {
	pair: DexPair | null | undefined;
	isLoading: boolean;
	error: Error | null;
	refetch: () => void;
} {
	const query = useQuery({
		queryKey: ['dex', 'pair', id?.chainId, id?.pairAddress],
		queryFn: () => call('dex:pair', id as PairId),
		enabled: id !== null,
		meta: SIDECAR_META,
		refetchInterval: POLL_MS,
	});
	return {
		pair: query.data,
		isLoading: query.isLoading,
		error: query.error,
		refetch: () => void query.refetch(),
	};
}

export function useDexSearch(q: string): {
	results: DexPair[];
	isFetching: boolean;
	error: Error | null;
} {
	const query = useQuery({
		queryKey: ['dex', 'search', q],
		queryFn: () => call('dex:search', q),
		enabled: q.trim().length >= 2,
		meta: SIDECAR_META,
		staleTime: 60_000,
	});
	return { results: query.data ?? [], isFetching: query.isFetching, error: query.error };
}

export function useWatchActions(): {
	watch: (pair: DexPair) => void;
	unwatch: (id: PairId) => void;
} {
	const watch = useMutation({
		mutationFn: (p: DexPair) =>
			call('dex:watch', {
				chainId: p.chainId,
				pairAddress: p.pairAddress,
				symbol: p.base.symbol,
			}),
		onSuccess: (_list, p) => toast.success('Watching', `${p.base.symbol}/${p.quote.symbol}`),
		onError: (error) => toast.error('Could not add to watchlist', error.message),
	});
	const unwatch = useMutation({
		mutationFn: (id: PairId) => call('dex:unwatch', id),
		onError: (error) => toast.error('Could not remove', error.message),
	});
	return { watch: watch.mutate, unwatch: unwatch.mutate };
}

export function pairKey(p: PairId): string {
	return `${p.chainId}:${p.pairAddress.toLowerCase()}`;
}
