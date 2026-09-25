import { type JSX, useMemo, useState } from 'react';

import type { FrameHistogram, FrameSummaryRow } from '@shared/ipc/channels/frames';

import { cn } from '../../lib/cn';
import { baseOption } from '../../lib/echarts';
import { EChart } from '../../ui/EChart';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { formatCell, isNumericType } from './frame-model';
import { useHistogram, useSummary } from './use-frame';

const STATS: Array<[keyof FrameSummaryRow, string]> = [
	['type', 'Type'],
	['count', 'Count'],
	['nullPercent', 'Null %'],
	['unique', '≈ Unique'],
	['min', 'Min'],
	['q25', 'P25'],
	['q50', 'Median'],
	['q75', 'P75'],
	['max', 'Max'],
	['mean', 'Mean'],
	['std', 'Std'],
];

function cell(value: FrameSummaryRow[keyof FrameSummaryRow]): string {
	if (value === null) return '';
	const n = typeof value === 'number' ? value : Number(value);
	// SUMMARIZE returns most stats as text; show numbers compactly without losing dates/strings.
	if (typeof value === 'string' && (value === '' || Number.isNaN(n))) return value;
	// Six significant digits: the table is for shape at a glance, the grid has exact values.
	return Number.isInteger(n) ? String(n) : formatCell(Number(n.toPrecision(6)));
}

function Histogram({ data, column }: { data: FrameHistogram; column: string }): JSX.Element {
	const option = useMemo(() => {
		const base = baseOption();
		const labels =
			data.kind === 'numeric'
				? data.counts.map((_, i) => formatCell(data.edges[i] ?? 0))
				: data.labels.map((l) => (l === null ? 'null' : formatCell(l)));
		return {
			...base,
			tooltip: { ...(base['tooltip'] as object), trigger: 'axis' },
			xAxis: { ...(base['xAxis'] as object), type: 'category', data: labels },
			yAxis: { ...(base['yAxis'] as object), scale: false },
			series: [
				{
					type: 'bar',
					name: column,
					data: data.counts,
					barCategoryGap: data.kind === 'numeric' ? '4%' : '30%',
				},
			],
		};
	}, [data, column]);
	return (
		<EChart option={option} notMerge className='h-full' aria-label={`${column} distribution`} />
	);
}

export function StatsView({ path, version }: { path: string; version: number }): JSX.Element {
	const summary = useSummary(path, version);
	const [column, setColumn] = useState<string | null>(null);
	const histogram = useHistogram(path, column, version);

	if (summary.isPending) {
		return (
			<div className='flex flex-1 items-center justify-center'>
				<Spinner label='Summarizing' />
			</div>
		);
	}
	if (summary.isError) {
		return (
			<ErrorState title='Summary failed' message={summary.error.message} className='flex-1' />
		);
	}
	return (
		<div className='flex min-h-0 flex-1 flex-col' data-frame-stats>
			<div className='min-h-0 flex-1 overflow-auto'>
				<table className='num w-full text-12'>
					<thead className='sticky top-0 bg-bg-2 text-11 text-fg-2'>
						<tr>
							<th className='px-2 py-1 text-left font-normal'>Column</th>
							{STATS.map(([, label]) => (
								<th key={label} className='px-2 py-1 text-right font-normal'>
									{label}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{summary.data.map((row) => (
							<tr
								key={row.column}
								onClick={() => setColumn(row.column)}
								className={cn(
									'cursor-default border-t border-border/60 hover:bg-bg-3',
									column === row.column && 'bg-accent-soft',
								)}
								data-stats-column={row.column}
							>
								<td className='px-2 py-1 text-fg-0'>
									<button
										type='button'
										className='text-left font-sans hover:underline focus-visible:shadow-glow focus-visible:outline-none'
										onClick={() => setColumn(row.column)}
										title={
											isNumericType(row.type)
												? 'Show distribution'
												: 'Show most frequent values'
										}
									>
										{row.column}
									</button>
								</td>
								{STATS.map(([key]) => (
									<td
										key={key}
										className='truncate px-2 py-1 text-right text-fg-1'
									>
										{key === 'type'
											? String(row.type).toLowerCase()
											: cell(row[key])}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			</div>
			{column && (
				<section className='flex h-56 shrink-0 flex-col border-t border-border'>
					<h3 className='px-3 py-1 text-12 text-fg-1'>
						{column}
						<span className='ml-2 text-11 text-fg-2'>
							{histogram.data?.kind === 'categorical'
								? 'top 20 values'
								: 'distribution'}
						</span>
					</h3>
					<div className='min-h-0 flex-1'>
						{histogram.data ? (
							<Histogram data={histogram.data} column={column} />
						) : histogram.isError ? (
							<p className='px-3 text-12 text-down'>{histogram.error.message}</p>
						) : (
							<Spinner />
						)}
					</div>
				</section>
			)}
		</div>
	);
}
