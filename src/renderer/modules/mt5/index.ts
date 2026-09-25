import { LineChart } from 'lucide-react';

import { manifest } from '@shared/modules/mt5.manifest';

import type { RendererModule } from '../types';
import { Mt5Panel } from './Mt5Panel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'mt5.panel',
			title: 'MT5',
			room: 'trade',
			icon: LineChart,
			component: Mt5Panel,
			defaultOpen: true,
			tabWith: 'dexscreener.watchlist',
		},
	],
	commands: [
		{
			id: 'mt5.show',
			title: 'Trade: Show MetaTrader 5 Account',
			room: 'trade',
			keywords: ['mt5', 'metatrader', 'forex', 'positions', 'account', 'p/l'],
			icon: LineChart,
			run: (ctx) => ctx.openPanel('mt5.panel'),
		},
	],
};
