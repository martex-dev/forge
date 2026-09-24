import { CandlestickChart } from 'lucide-react';

import { manifest } from '@shared/modules/tradingview.manifest';

import type { RendererModule } from '../types';
import { TradingViewPanel } from './TradingViewPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'tradingview.chart',
			title: 'TradingView',
			room: 'trade',
			icon: CandlestickChart,
			component: TradingViewPanel,
			defaultOpen: true,
			renderer: 'always',
		},
	],
	commands: [
		{
			id: 'tradingview.open',
			title: 'Trade: Open TradingView',
			room: 'trade',
			keywords: ['chart', 'tv'],
			icon: CandlestickChart,
			run: (ctx) => ctx.openPanel('tradingview.chart'),
		},
	],
};
