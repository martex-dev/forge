import { type JSX, type ReactNode, useMemo } from 'react';

import type { Gpu } from '@shared/ipc/channels/lab';

import { cn } from '../../lib/cn';
import { baseOption, chartColors } from '../../lib/echarts';
import { EChart } from '../../ui/EChart';
import { formatGiB, type GpuSample, memoryPercent, temperatureLevel } from './gpu-model';

function Stat({
	label,
	children,
	className,
}: {
	label: string;
	children: ReactNode;
	className?: string;
}): JSX.Element {
	return (
		<div className='flex flex-col gap-0.5 rounded-sm border border-border bg-bg-2 px-2 py-1.5'>
			<span className='text-11 text-fg-2'>{label}</span>
			<span className={cn('num text-16 font-semibold text-fg-0', className)}>{children}</span>
		</div>
	);
}

function Bar({ percent }: { percent: number | null }): JSX.Element {
	return (
		<div className='mt-1 h-1 overflow-hidden rounded-full bg-bg-3' aria-hidden>
			<div
				className='h-full bg-accent'
				style={{ width: `${Math.min(100, percent ?? 0)}%` }}
			/>
		</div>
	);
}

const TEMP_CLASS = { ok: 'text-fg-0', warn: 'text-warn', hot: 'text-down' } as const;
const clock = (t: number): string => new Date(t).toLocaleTimeString([], { hour12: false });

export function GpuCard({
	gpu,
	samples,
}: {
	gpu: Gpu;
	samples: readonly GpuSample[];
}): JSX.Element {
	const mem = memoryPercent(gpu);
	const option = useMemo(() => {
		const base = baseOption();
		const [util, vram] = chartColors().series;
		return {
			...base,
			grid: { left: 4, right: 8, top: 24, bottom: 4, containLabel: true },
			legend: {
				top: 0,
				right: 0,
				itemWidth: 8,
				itemHeight: 8,
				textStyle: { color: chartColors().muted, fontSize: 10 },
			},
			xAxis: {
				...(base['xAxis'] as object),
				type: 'time',
				axisLabel: { show: false },
			},
			yAxis: { ...(base['yAxis'] as object), scale: false, min: 0, max: 100, splitNumber: 2 },
			tooltip: {
				...(base['tooltip'] as object),
				valueFormatter: (v: unknown) => (typeof v === 'number' ? `${v.toFixed(0)}%` : '—'),
			},
			series: [
				{
					type: 'line',
					name: 'GPU',
					data: samples.map((s) => [s.t, s.utilization]),
					showSymbol: false,
					lineStyle: { width: 1.5, color: util },
					areaStyle: { opacity: 0.12, color: util },
				},
				{
					type: 'line',
					name: 'VRAM',
					data: samples.map((s) => [s.t, s.memory]),
					showSymbol: false,
					lineStyle: { width: 1.5, color: vram },
				},
			],
		};
	}, [samples]);

	return (
		<section className='rounded-sm border border-border bg-bg-1 p-3' data-gpu={gpu.index}>
			<h3 className='mb-2 truncate text-13 font-medium text-fg-0'>{gpu.name}</h3>
			<div className='mb-2 grid grid-cols-2 gap-2'>
				<Stat label='Utilization'>
					<span data-gpu-util>
						{gpu.utilization === null ? '—' : `${gpu.utilization}%`}
					</span>
					<Bar percent={gpu.utilization} />
				</Stat>
				<Stat label='VRAM'>
					{formatGiB(gpu.memoryUsed)}
					<span className='text-12 font-normal text-fg-2'>
						{' '}
						/ {formatGiB(gpu.memoryTotal)} GB
					</span>
					<Bar percent={mem} />
				</Stat>
				<Stat label='Temperature' className={TEMP_CLASS[temperatureLevel(gpu.temperature)]}>
					{gpu.temperature === null ? '—' : `${gpu.temperature}°C`}
				</Stat>
				<Stat label='Power'>
					{gpu.power === null ? '—' : `${gpu.power.toFixed(0)}`}
					<span className='text-12 font-normal text-fg-2'>
						{gpu.powerLimit === null ? ' W' : ` / ${gpu.powerLimit.toFixed(0)} W`}
					</span>
				</Stat>
			</div>
			{samples.length > 1 && (
				<>
					<EChart
						option={option}
						className='h-28'
						aria-label='GPU and VRAM usage, last 3 minutes'
					/>
					<div className='num flex justify-between text-11 text-fg-2'>
						<span>{clock(samples[0]?.t ?? 0)}</span>
						<span>{clock(samples.at(-1)?.t ?? 0)}</span>
					</div>
				</>
			)}
		</section>
	);
}
