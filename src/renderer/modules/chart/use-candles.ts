import { useQuery } from '@tanstack/react-query';

import type { CandleSeries, ChartSource, Interval } from '@shared/ipc/channels/chart';
import type { WatchEntry } from '@shared/ipc/channels/dex';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { call } from '../../lib/ipc';
import { useUiStore } from '../../stores/ui-store';
import { sourceKey } from './chart-model';

// Binance is cached ~5 s in the sidecar; GeckoTerminal only refreshes OHLCV about once a minute.
const POLL_MS = { binance: 5_000, pool: 30_000 } as const;

export function useCandles(
	source: ChartSource | null,
	interval: Interval,
): {
	series: CandleSeries | undefined;
	isLoading: boolean;
	isFetching: boolean;
	error: Error | null;
	refetch: () => void;
} {
	// All rooms stay mounted; don't spend Binance/GeckoTerminal quota on a chart nobody sees.
	const visible = useUiStore((s) => s.room === 'trade');
	const query = useQuery({
		queryKey: ['chart', source ? sourceKey(source) : null, interval],
		queryFn: () => call('chart:candles', { source: source as ChartSource, interval }),
		enabled: source !== null,
		meta: SIDECAR_META,
		refetchInterval: source && visible ? POLL_MS[source.kind] : false,
		staleTime: 2_000,
	});
	return {
		series: query.data,
		isLoading: query.isLoading,
		isFetching: query.isFetching,
		error: query.error,
		refetch: () => void query.refetch(),
	};
}

/** The DexScreener watchlist doubles as the pool picker (same cache key as its own panel). */
export function useWatchedPools(): { pools: WatchEntry[]; error: Error | null } {
	const query = useQuery({
		queryKey: ['dex', 'watchlist'],
		queryFn: () => call('dex:watchlist'),
	});
	return { pools: query.data ?? [], error: query.error };
}
