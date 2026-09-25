import { type JSX, useMemo } from 'react';

import { baseOption, chartColors } from '../../lib/echarts';
import { EChart } from '../../ui/EChart';
import { formatMetric, lastValue, type Series } from './runs-model';

interface MetricChartProps {
	title: string;
	keys: string[];
	series: Series;
}

export function MetricChart({ title, keys, series }: MetricChartProps): JSX.Element {
	const colors = chartColors().series;
	const option = useMemo(
		() => ({
			...baseOption(),
			xAxis: { ...(baseOption()['xAxis'] as object), minInterval: 1 },
			dataZoom: [{ type: 'inside', xAxisIndex: 0, filterMode: 'none' }],
			series: keys.map((key) => ({
				type: 'line',
				name: key,
				data: series[key] ?? [],
				showSymbol: false,
				// Thousands of steps: LTTB keeps the shape (spikes included) at a fraction of the points.
				sampling: 'lttb',
				lineStyle: { width: 1.5 },
				emphasis: { disabled: true },
			})),
		}),
		[keys, series],
	);

	return (
		<section
			className='flex h-56 flex-col rounded-sm border border-border bg-bg-1'
			data-metric-chart={title}
		>
			<header className='flex items-baseline gap-3 border-b border-border px-2 py-1'>
				<h3 className='text-12 font-medium text-fg-0'>{title}</h3>
				<div className='num ml-auto flex gap-3 text-11'>
					{keys.map((key, i) => (
						<span key={key} className='flex items-center gap-1 text-fg-2'>
							{keys.length > 1 && (
								<span
									className='inline-block size-2 rounded-full'
									style={{ backgroundColor: colors[i % colors.length] }}
								/>
							)}
							{keys.length > 1 ? `${key} ` : ''}
							<span className='text-fg-0' data-metric-last={key}>
								{formatMetric(lastValue(series[key]))}
							</span>
						</span>
					))}
				</div>
			</header>
			<EChart option={option} className='flex-1' aria-label={`${title} by step`} />
		</section>
	);
}
