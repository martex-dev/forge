import { type JSX, useMemo } from 'react';

import type { Calibration } from '@shared/ipc/channels/lab';

import { baseOption, chartColors } from '../../lib/echarts';
import { EChart } from '../../ui/EChart';
import { reliabilityPoints } from './artifacts-model';
import { formatMetric } from './runs-model';

export function CalibrationView({ name, data }: { name: string; data: Calibration }): JSX.Element {
	const entries = useMemo(() => Object.entries(data.reports), [data]);
	const colors = useMemo(() => chartColors().series, []);
	const option = useMemo(() => {
		const base = baseOption();
		const { muted } = chartColors();
		const axis = { ...(base['yAxis'] as object), type: 'value', min: 0, max: 1, scale: false };
		const model = data.reports['model'];
		return {
			...base,
			grid: [
				{ left: 8, right: 12, top: 12, height: '62%', containLabel: true },
				{ left: 8, right: 12, bottom: 8, height: '18%', containLabel: true },
			],
			tooltip: { ...(base['tooltip'] as object), trigger: 'item' },
			xAxis: [
				{ ...(base['xAxis'] as object), type: 'value', min: 0, max: 1, gridIndex: 0 },
				{ ...(base['xAxis'] as object), type: 'value', min: 0, max: 1, gridIndex: 1 },
			],
			yAxis: [
				{ ...axis, gridIndex: 0, name: 'observed' },
				{
					...(base['yAxis'] as object),
					type: 'value',
					gridIndex: 1,
					scale: false,
					// Counts are in the tooltip; labels on a strip this short only collide.
					axisLabel: { show: false },
					splitLine: { show: false },
				},
			],
			series: [
				{
					type: 'line',
					name: 'perfect',
					data: [
						[0, 0],
						[1, 1],
					],
					showSymbol: false,
					lineStyle: { type: 'dashed', width: 1, color: muted },
					tooltip: { show: false },
				},
				...entries.map(([label, report], i) => ({
					type: 'line',
					name: label,
					data: reliabilityPoints(report.bins),
					symbolSize: 6,
					lineStyle: { width: 1.5, color: colors[i % colors.length] },
					itemStyle: { color: colors[i % colors.length] },
				})),
				// Bin counts always shown (as calibrate does): a big gap in a 3-sample bin is noise.
				{
					type: 'bar',
					name: 'samples',
					xAxisIndex: 1,
					yAxisIndex: 1,
					barWidth: '60%',
					data: (model?.bins ?? []).map((b) => [(b.lower + b.upper) / 2, b.count]),
					itemStyle: { color: muted, opacity: 0.6 },
				},
			],
		};
	}, [data, entries, colors]);

	return (
		<section
			className='@container rounded-sm border border-border bg-bg-1 p-2'
			data-calibration={name}
		>
			<h3 className='mb-1 text-12 font-medium text-fg-0'>Calibration · {name}</h3>
			<div className='grid gap-3 @2xl:grid-cols-[minmax(0,1fr)_minmax(16rem,22rem)]'>
				<EChart
					option={option}
					notMerge
					className='h-72'
					aria-label={`Reliability diagram, ${name}`}
				/>
				<div className='flex flex-col gap-2'>
					<table className='num w-full text-12'>
						<thead className='text-11 text-fg-2'>
							<tr>
								<th className='text-left font-normal'>&nbsp;</th>
								<th className='text-right font-normal'>ECE</th>
								<th className='text-right font-normal'>MCE</th>
								<th className='text-right font-normal'>Brier</th>
								<th className='text-right font-normal'>n</th>
							</tr>
						</thead>
						<tbody>
							{entries.map(([label, r], i) => (
								<tr
									key={label}
									className='border-t border-border/60'
									data-calibration-report={label}
								>
									<td className='py-0.5 font-sans text-fg-0'>
										<span
											className='mr-1.5 inline-block size-2 rounded-full'
											style={{ backgroundColor: colors[i % colors.length] }}
										/>
										{label}
									</td>
									<td className='text-right text-fg-0'>{formatMetric(r.ece)}</td>
									<td className='text-right text-fg-1'>{formatMetric(r.mce)}</td>
									<td className='text-right text-fg-1'>
										{formatMetric(r.brier)}
									</td>
									<td className='text-right text-fg-2'>{r.n_samples}</td>
								</tr>
							))}
						</tbody>
					</table>
					{entries.map(([label, r]) => (
						<p key={label} className='text-12 text-fg-1'>
							<span className='text-fg-2'>{label}: </span>
							{r.flag}
						</p>
					))}
				</div>
			</div>
		</section>
	);
}
