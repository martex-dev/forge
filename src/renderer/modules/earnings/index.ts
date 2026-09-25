import { Presentation, Settings2 } from 'lucide-react';

import { manifest } from '@shared/modules/earnings.manifest';

import type { RendererModule } from '../types';
import { EarningsPanel } from './EarningsPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'earnings.panel',
			title: 'Earnings',
			room: 'trade',
			icon: Presentation,
			component: EarningsPanel,
			defaultOpen: true,
			tabWith: 'calendar.week',
		},
	],
	commands: [
		{
			id: 'earnings.show',
			title: 'Trade: Earnings Calendar',
			room: 'trade',
			keywords: ['earnings', 'eps', 'reports', 'stocks', 'nasdaq', 's&p'],
			icon: Presentation,
			run: (ctx) => ctx.openPanel('earnings.panel', { params: { week: 0 } }),
		},
		{
			id: 'earnings.source',
			title: 'Trade: Earnings Source…',
			room: 'trade',
			keywords: ['earnings', 'finnhub', 'nasdaq', 'market calendar', 'settings'],
			icon: Settings2,
			run: (ctx) => ctx.openPanel('earnings.panel', { params: { settings: true } }),
		},
	],
};
