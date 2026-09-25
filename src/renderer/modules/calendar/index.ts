import { CalendarDays } from 'lucide-react';

import { manifest } from '@shared/modules/calendar.manifest';

import type { RendererModule } from '../types';
import { CalendarPanel } from './CalendarPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'calendar.week',
			title: 'Economic Calendar',
			room: 'trade',
			icon: CalendarDays,
			component: CalendarPanel,
			defaultOpen: true,
			position: 'right',
			initialSize: 520,
		},
	],
	commands: [
		{
			id: 'calendar.show',
			title: 'Trade: Show Economic Calendar',
			room: 'trade',
			keywords: ['forex factory', 'news', 'events', 'macro', 'nfp', 'cpi'],
			icon: CalendarDays,
			run: (ctx) => ctx.openPanel('calendar.week'),
		},
	],
};
