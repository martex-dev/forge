import { Bell } from 'lucide-react';

import { manifest } from '@shared/modules/alerts.manifest';

import type { RendererModule } from '../types';
import { AlertsPanel } from './AlertsPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'alerts.panel',
			title: 'Alerts',
			room: 'trade',
			icon: Bell,
			component: AlertsPanel,
			defaultOpen: true,
			tabWith: 'calendar.week',
		},
	],
	commands: [
		{
			id: 'alerts.new',
			title: 'Trade: New Price Alert',
			room: 'trade',
			keywords: ['alert', 'price', 'notify', 'threshold'],
			icon: Bell,
			run: (ctx) => ctx.openPanel('alerts.panel', { params: { draft: { kind: 'price' } } }),
		},
		{
			id: 'alerts.newCalendar',
			title: 'Trade: New Calendar Alert',
			room: 'trade',
			keywords: ['alert', 'calendar', 'nfp', 'cpi', 'event'],
			icon: Bell,
			run: (ctx) =>
				ctx.openPanel('alerts.panel', { params: { draft: { kind: 'calendar' } } }),
		},
	],
};
