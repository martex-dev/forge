import { GitCompareArrows, X } from 'lucide-react';
import { type JSX, useMemo } from 'react';

import { chartColors } from '../../lib/echarts';
import { EmptyState } from '../../ui/EmptyState';
import { Select } from '../../ui/Select';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { MAX_COMPARE, sharedKeys } from './compare-model';
import { CompareCharts } from './CompareCharts';
import { ConfigTable, SummaryTable } from './CompareTables';
import { RunStatusDot } from './RunStatusDot';
import { useCompareDetails, useCompareSeries, useCompareSummary } from './use-compare';
import { useRuns } from './use-runs';

export function RunComparePanel({ params, setParams }: PanelProps): JSX.Element {
	const { runs: all, isLoading } = useRuns();
	const rawIds = params['ids'];
	const wanted = useMemo(() => (Array.isArray(rawIds) ? (rawIds as string[]) : []), [rawIds]);
	// Deleted runs drop out on their own.
	const runs = useMemo(
		() => wanted.flatMap((id) => all.filter((r) => r.id === id)),
		[wanted, all],
	);
	const ids = useMemo(() => runs.map((r) => r.id), [runs]);
	const live = useMemo(
		() => new Set(runs.filter((r) => r.status === 'running').map((r) => r.id)),
		[runs],
	);
	const details = useCompareDetails(ids);
	const summary = useCompareSummary(ids, live.size > 0);
	const series = useCompareSeries(ids, live);
	const smoothing = typeof params['smoothing'] === 'number' ? params['smoothing'] : 0.6;
	const runColors = useMemo(() => {
		const { series, muted } = chartColors();
		return runs.map((_, i) => series[i % series.length] ?? muted);
	}, [runs]);
	const keys = useMemo(() => sharedKeys(runs.map((r) => r.metricKeys)), [runs]);
	const setIds = (next: string[]): void => setParams({ ids: next });

	if (isLoading) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Loading runs' />
			</div>
		);
	}
	const addable = all.filter((r) => !ids.includes(r.id));
	return (
		<div className='flex h-full flex-col bg-bg-1' data-compare>
			<header className='flex flex-wrap items-center gap-1.5 border-b border-border px-2 py-1'>
				{runs.map((r, i) => (
					<span
						key={r.id}
						className='flex h-6 items-center gap-1.5 rounded-sm border border-border bg-bg-2 pr-0.5 pl-2 text-12'
						data-compare-run={r.name}
					>
						<span
							className='size-2 rounded-full'
							style={{ backgroundColor: runColors[i] }}
						/>
						<span className='max-w-32 truncate text-fg-0' title={r.name}>
							{r.name}
						</span>
						<RunStatusDot status={r.status} />
						<button
							type='button'
							aria-label={`Remove ${r.name}`}
							onClick={() => setIds(ids.filter((id) => id !== r.id))}
							className='rounded-sm p-0.5 text-fg-2 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
						>
							<X size={11} />
						</button>
					</span>
				))}
				{runs.length < MAX_COMPARE && addable.length > 0 && (
					<Select
						aria-label='Add run'
						className='h-6 min-w-36'
						value=''
						placeholder='Add run…'
						onValueChange={(id) => setIds([...ids, id])}
						options={addable.slice(0, 50).map((r) => ({
							value: r.id,
							label: r.project ? `${r.name} · ${r.project}` : r.name,
						}))}
					/>
				)}
				<label className='ml-auto flex items-center gap-2 text-11 text-fg-2'>
					Smoothing
					<input
						type='range'
						min={0}
						max={0.99}
						step={0.01}
						value={smoothing}
						onChange={(e) => setParams({ smoothing: Number(e.target.value) })}
						aria-label='Smoothing'
						className='w-24 accent-[var(--accent)]'
					/>
					<span className='num w-8 text-fg-1'>{smoothing.toFixed(2)}</span>
				</label>
			</header>
			{runs.length < 2 ? (
				<EmptyState
					icon={<GitCompareArrows size={20} />}
					title={runs.length === 0 ? 'Pick runs to compare' : 'Add another run'}
					description='Up to 8 runs side by side: final metrics (best highlighted), config differences and overlaid curves.'
				/>
			) : (
				<div className='flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-3'>
					{summary.data ? (
						<SummaryTable
							runs={runs}
							colors={runColors}
							keys={keys}
							summaries={summary.data}
						/>
					) : (
						<Spinner label='Summarizing' />
					)}
					<ConfigTable runs={runs} colors={runColors} details={details} />
					<CompareCharts
						keys={keys}
						runs={runs}
						colors={runColors}
						series={series}
						smoothing={smoothing}
					/>
				</div>
			)}
		</div>
	);
}
