import { type JSX, useMemo } from 'react';

import type { Run, RunSeries } from '@shared/ipc/channels/lab';

import { baseOption } from '../../lib/echarts';
import { EChart } from '../../ui/EChart';
import { smooth } from './compare-model';

function OverlayChart({
	metric,
	runs,
	colors,
	series,
	smoothing,
}: {
	metric: string;
	runs: Run[];
	colors: string[];
	series: Array<RunSeries | undefined>;
	smoothing: number;
}): JSX.Element {
	const option = useMemo(() => {
		const base = baseOption();
		const lines = runs.flatMap((run, i) => {
			const raw = series[i]?.[metric];
			if (!raw) return [];
			const color = colors[i];
			const smoothed = {
				type: 'line',
				name: run.name,
				data: smooth(raw, smoothing),
				showSymbol: false,
				lineStyle: { width: 1.5, color },
				itemStyle: { color },
				emphasis: { disabled: true },
			};
			// The raw curve stays visible, faint, behind the smoothed one (as in TensorBoard).
			return smoothing > 0
				? [
						{
							...smoothed,
							name: `${run.name} (raw)`,
							data: raw,
							lineStyle: { width: 1, color, opacity: 0.2 },
							tooltip: { show: false },
						},
						smoothed,
					]
				: [smoothed];
		});
		return {
			...base,
			xAxis: { ...(base['xAxis'] as object), minInterval: 1 },
			dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }],
			series: lines,
		};
	}, [metric, runs, colors, series, smoothing]);

	return (
		<section
			className='flex h-56 flex-col rounded-sm border border-border bg-bg-1'
			data-compare-chart={metric}
		>
			<h4 className='border-b border-border px-2 py-1 text-12 font-medium text-fg-0'>
				{metric}
			</h4>
			<EChart
				option={option}
				notMerge
				className='flex-1'
				aria-label={`${metric} by step, all runs`}
			/>
		</section>
	);
}

export function CompareCharts({
	keys,
	runs,
	colors,
	series,
	smoothing,
}: {
	keys: string[];
	runs: Run[];
	colors: string[];
	series: Array<RunSeries | undefined>;
	smoothing: number;
}): JSX.Element {
	return (
		<section aria-label='Charts'>
			<h3 className='mb-1 text-12 font-medium text-fg-1'>Charts</h3>
			<div className='grid grid-cols-[repeat(auto-fill,minmax(22rem,1fr))] gap-2'>
				{keys.map((key) => (
					<OverlayChart
						key={key}
						metric={key}
						runs={runs}
						colors={colors}
						series={series}
						smoothing={smoothing}
					/>
				))}
			</div>
		</section>
	);
}
