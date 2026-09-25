import { type JSX, useEffect, useRef } from 'react';

import { cn } from '@renderer/lib/cn';
import { echarts, type EChartsOption } from '@renderer/lib/echarts';

interface EChartProps {
	option: EChartsOption;
	/** Replace instead of merge: needed when series are added or removed. */
	notMerge?: boolean;
	className?: string;
	'aria-label': string;
}

/** A canvas ECharts instance that follows its container's size. */
export function EChart({
	option,
	notMerge = false,
	className,
	'aria-label': ariaLabel,
}: EChartProps): JSX.Element {
	const hostRef = useRef<HTMLDivElement>(null);
	const chartRef = useRef<echarts.ECharts | null>(null);

	useEffect(() => {
		const el = hostRef.current;
		if (!el) return;
		const chart = echarts.init(el, null, { renderer: 'canvas' });
		chartRef.current = chart;
		const observer = new ResizeObserver(() => chart.resize());
		observer.observe(el);
		return () => {
			observer.disconnect();
			chart.dispose();
			chartRef.current = null;
		};
	}, []);

	useEffect(() => {
		chartRef.current?.setOption(option, { notMerge, lazyUpdate: true });
	}, [option, notMerge]);

	return (
		<div ref={hostRef} role='img' aria-label={ariaLabel} className={cn('min-h-0', className)} />
	);
}
