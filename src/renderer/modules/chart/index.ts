import { ChartCandlestick, LayoutGrid, SquarePlus } from 'lucide-react';

import { manifest } from '@shared/modules/chart.manifest';

import { getLayoutApi, nextInstanceId } from '../../app/layout/layout-controller';
import type { CommandContext, RendererModule } from '../types';
import { ChartPanel } from './ChartPanel';

const CHART = 'chart.main';

/** Opens another chart instance beside `anchor` (or the main chart). Returns its id. */
function addChart(
	ctx: CommandContext,
	symbol: string,
	anchor: string,
	direction: 'right' | 'below',
): string | null {
	const api = getLayoutApi('trade');
	if (!api) return null;
	const instanceId = nextInstanceId(api, CHART);
	ctx.openPanel(CHART, {
		instanceId,
		params: { source: { kind: 'binance', symbol }, interval: '1h' },
		...(api.getPanel(anchor) ? { near: { panelId: anchor, direction } } : {}),
	});
	return instanceId;
}

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: CHART,
			title: 'Chart',
			room: 'trade',
			icon: ChartCandlestick,
			component: ChartPanel,
			defaultOpen: true,
			tabWith: 'tradingview.chart',
		},
	],
	commands: [
		{
			id: 'chart.show',
			title: 'Trade: Show Chart',
			room: 'trade',
			keywords: ['candles', 'ohlc', 'binance', 'geckoterminal', 'price'],
			icon: ChartCandlestick,
			run: (ctx) => ctx.openPanel(CHART),
		},
		{
			id: 'chart.new',
			title: 'Trade: New Chart',
			room: 'trade',
			keywords: ['chart', 'split', 'multi', 'compare'],
			icon: SquarePlus,
			run: (ctx) => {
				ctx.switchRoom('trade');
				const active = getLayoutApi('trade')?.activePanel?.id;
				addChart(ctx, 'ETHUSDT', active?.startsWith(CHART) ? active : CHART, 'right');
			},
		},
		{
			id: 'chart.grid',
			title: 'Trade: Chart Grid (2×2)',
			room: 'trade',
			keywords: ['chart', 'grid', 'layout', 'multi', 'four'],
			icon: LayoutGrid,
			run: (ctx) => {
				ctx.openPanel(CHART);
				// Main chart top-left, then ETH right of it, SOL below it, BNB below ETH.
				const topRight = addChart(ctx, 'ETHUSDT', CHART, 'right');
				addChart(ctx, 'SOLUSDT', CHART, 'below');
				if (topRight) addChart(ctx, 'BNBUSDT', topRight, 'below');
			},
		},
	],
};
