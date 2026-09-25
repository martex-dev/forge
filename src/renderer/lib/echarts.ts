import { LineChart } from 'echarts/charts';
import {
	DataZoomComponent,
	GridComponent,
	LegendComponent,
	TooltipComponent,
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

import { resolveToken } from './resolve-color';

// Only what we draw: keeps ECharts' bundle share small (the full build is ~1 MB).
echarts.use([
	LineChart,
	GridComponent,
	TooltipComponent,
	LegendComponent,
	DataZoomComponent,
	CanvasRenderer,
]);

export { echarts };
export type EChartsOption = echarts.EChartsCoreOption;

export interface ChartColors {
	text: string;
	muted: string;
	grid: string;
	border: string;
	surface: string;
	series: string[];
}

let cached: ChartColors | null = null;

/** Design tokens resolved to hex (canvas can't read CSS variables). Dark-only app: cache once. */
export function chartColors(): ChartColors {
	cached ??= {
		text: resolveToken('--text-1'),
		muted: resolveToken('--text-2'),
		grid: resolveToken('--border'),
		border: resolveToken('--border-strong'),
		surface: resolveToken('--bg-2'),
		series: [
			'--accent-lab',
			'--info',
			'--accent-hub',
			'--up',
			'--accent-build',
			'--down',
			'--warn',
		].map(resolveToken),
	};
	return cached;
}

/** Shared axis/tooltip styling so every chart in Forge looks the same. */
export function baseOption(): EChartsOption {
	const c = chartColors();
	const axis = {
		axisLine: { lineStyle: { color: c.border } },
		axisTick: { show: false },
		axisLabel: { color: c.muted, fontFamily: 'JetBrains Mono', fontSize: 10 },
		splitLine: { lineStyle: { color: c.grid } },
	};
	return {
		animation: false,
		color: c.series,
		textStyle: { fontFamily: 'Geist Sans, system-ui, sans-serif', color: c.text },
		grid: { left: 8, right: 12, top: 12, bottom: 8, containLabel: true },
		xAxis: { type: 'value', ...axis, splitLine: { show: false } },
		yAxis: { type: 'value', scale: true, ...axis },
		tooltip: {
			trigger: 'axis',
			backgroundColor: c.surface,
			borderColor: c.border,
			textStyle: { color: c.text, fontFamily: 'JetBrains Mono', fontSize: 11 },
			axisPointer: { lineStyle: { color: c.border } },
		},
	};
}
