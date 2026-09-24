import { CandlestickChart } from 'lucide-react';

import { manifest } from '@shared/modules/trade-core.manifest';

import type { RendererModule } from '../types';
import { TradeWelcomePanel } from './TradeWelcomePanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'trade-core.welcome',
			title: 'Welcome',
			room: 'trade',
			icon: CandlestickChart,
			component: TradeWelcomePanel,
			defaultOpen: true,
		},
	],
	commands: [
		{
			id: 'trade-core.showWelcome',
			title: 'Trade: Show Welcome',
			room: 'trade',
			icon: CandlestickChart,
			run: (ctx) => ctx.openPanel('trade-core.welcome'),
		},
	],
};
