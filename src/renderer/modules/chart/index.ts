import { ChartCandlestick } from 'lucide-react';

import { manifest } from '@shared/modules/chart.manifest';

import type { RendererModule } from '../types';
import { ChartPanel } from './ChartPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'chart.main',
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
			run: (ctx) => ctx.openPanel('chart.main'),
		},
	],
};
