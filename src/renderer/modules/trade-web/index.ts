import { CalendarDays, Globe, Rocket } from 'lucide-react';
import { createElement } from 'react';

import { manifest } from '@shared/modules/trade-web.manifest';
import { getWebService } from '@shared/webviews';

import { WebviewPanel } from '../../app/webview/WebviewPanel';
import type { CommandDefinition, PanelDefinition, RendererModule } from '../types';

const SITES = [
	{ serviceId: 'axiom', icon: Rocket },
	{ serviceId: 'fomo', icon: Globe },
	{ serviceId: 'forexfactory', icon: CalendarDays },
] as const;

const panels: PanelDefinition[] = SITES.map(({ serviceId, icon }) => ({
	id: `trade-web.${serviceId}`,
	title: getWebService(serviceId)?.name ?? serviceId,
	room: 'trade',
	icon,
	component: ({ panelId, room }) =>
		createElement(WebviewPanel, { serviceId, instanceId: panelId, room }),
	// Stay mounted so logins/scroll position survive switching dock tabs.
	renderer: 'always',
	tabWith: 'tradingview.chart',
}));

const commands: CommandDefinition[] = SITES.map(({ serviceId, icon }) => ({
	id: `trade-web.open.${serviceId}`,
	title: `Trade: Open ${getWebService(serviceId)?.name ?? serviceId}`,
	room: 'trade',
	keywords: ['web', 'site', serviceId],
	icon,
	run: (ctx) => ctx.openPanel(`trade-web.${serviceId}`),
}));

export const rendererModule: RendererModule = { manifest, panels, commands };
