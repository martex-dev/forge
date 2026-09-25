import { Sunrise } from 'lucide-react';

import { manifest } from '@shared/modules/today.manifest';

import type { RendererModule } from '../types';
import { TodayPanel } from './TodayPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'today.panel',
			title: 'Today',
			room: 'hub',
			icon: Sunrise,
			component: TodayPanel,
			defaultOpen: true,
			position: 'tab',
		},
	],
	commands: [
		{
			id: 'today.show',
			title: 'Hub: Today',
			room: 'global',
			shortcut: 'Ctrl+Shift+T',
			keywords: ['dashboard', 'overview', 'day', 'morning', 'summary'],
			icon: Sunrise,
			run: (ctx) => ctx.openPanel('today.panel'),
		},
	],
};
