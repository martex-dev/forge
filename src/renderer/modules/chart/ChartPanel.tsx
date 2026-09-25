import { ChartCandlestick } from 'lucide-react';
import { type JSX, useState } from 'react';

import { cn } from '../../lib/cn';
import { formatPercent, formatPrice } from '../../lib/format';
import { Badge } from '../../ui/Badge';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { CandleChart } from './CandleChart';
import {
	type ChartParams,
	DEFAULT_SOURCE,
	readParams,
	sourceKey,
	sourceLabel,
	summarize,
} from './chart-model';
import { type ChartMode, ChartToolbar } from './ChartToolbar';
import { useCandles } from './use-candles';

export function ChartPanel({ params: rawParams, setParams }: PanelProps): JSX.Element {
	const params = readParams(rawParams);
	const { source, interval, label } = params;
	const [mode, setMode] = useState<ChartMode>(source.kind);
	const [shownKind, setShownKind] = useState(source.kind);
	// Opening a pool from the Token panel switches the source under us: follow it.
	if (shownKind !== source.kind) {
		setShownKind(source.kind);
		setMode(source.kind);
	}
	// In pool mode with no pool picked yet, don't keep charting the old Binance symbol.
	const active = mode === source.kind ? source : null;
	const { series, isLoading, isFetching, error, refetch } = useCandles(active, interval);

	const change = (patch: Partial<ChartParams>): void => setParams(patch);
	const changeMode = (next: ChartMode): void => {
		setMode(next);
		if (next === 'binance' && source.kind !== 'binance') change({ source: DEFAULT_SOURCE });
	};

	const summary = series ? summarize(series.candles) : null;
	const status = (
		<>
			{isFetching && !isLoading && <Spinner size={12} label='Updating chart' />}
			{series?.stale && (
				<span title='Upstream refresh failed; showing the last good data'>
					<Badge tone='warn'>stale</Badge>
				</span>
			)}
			{active && summary && (
				<span className='num flex items-baseline gap-2 text-12'>
					<span className='text-fg-1'>{sourceLabel(active, label)}</span>
					<span className='text-14 font-semibold text-fg-0'>
						{formatPrice(summary.last)}
					</span>
					<span
						className={cn(
							summary.change === null
								? 'text-fg-2'
								: summary.change >= 0
									? 'text-up'
									: 'text-down',
						)}
						title='Change over the loaded bars'
					>
						{formatPercent(summary.change)}
					</span>
				</span>
			)}
		</>
	);

	let body: JSX.Element;
	if (!active) {
		body = (
			<EmptyState
				icon={<ChartCandlestick size={20} />}
				title='Pick a pool'
				description='Choose a pair from your DexScreener watchlist, or open one from its Token panel.'
			/>
		);
	} else if (isLoading) {
		body = (
			<div className='flex h-full items-center justify-center'>
				<Spinner label='Loading candles' />
			</div>
		);
	} else if (error) {
		body = <ErrorState title='Chart unavailable' message={error.message} onRetry={refetch} />;
	} else if (!series || series.candles.length === 0) {
		body = (
			<EmptyState
				icon={<ChartCandlestick size={20} />}
				title='No candles'
				description='No trades in this range yet. Try a longer interval.'
			/>
		);
	} else {
		body = (
			<CandleChart candles={series.candles} seriesKey={`${sourceKey(active)}|${interval}`} />
		);
	}

	return (
		<div className='flex h-full flex-col bg-bg-1' data-chart-panel>
			<ChartToolbar
				mode={mode}
				params={params}
				onMode={changeMode}
				onChange={change}
				status={status}
			/>
			<div className='min-h-0 flex-1'>{body}</div>
		</div>
	);
}
