import { AtSign, BookText, BriefcaseBusiness, MessagesSquare } from 'lucide-react';
import { createElement } from 'react';

import { manifest } from '@shared/modules/hub-web.manifest';
import { getWebService } from '@shared/webviews';

import { WebviewPanel } from '../../app/webview/WebviewPanel';
import type { CommandDefinition, PanelDefinition, RendererModule } from '../types';

const SITES = [
	{ serviceId: 'discord', icon: MessagesSquare, keywords: ['chat', 'server', 'dm'] },
	{ serviceId: 'linkedin', icon: BriefcaseBusiness, keywords: ['social', 'jobs', 'network'] },
	{ serviceId: 'x', icon: AtSign, keywords: ['twitter', 'social', 'feed'] },
	{ serviceId: 'notion-web', icon: BookText, keywords: ['notes', 'wiki', 'docs'] },
] as const;

const panels: PanelDefinition[] = SITES.map(({ serviceId, icon }) => ({
	id: `hub-web.${serviceId}`,
	title: getWebService(serviceId)?.name ?? serviceId,
	room: 'hub',
	icon,
	component: ({ panelId, room }) =>
		createElement(WebviewPanel, { serviceId, instanceId: panelId, room }),
	// Stay mounted so logins/scroll position survive switching dock tabs.
	renderer: 'always',
	position: 'tab',
}));

const commands: CommandDefinition[] = SITES.map(({ serviceId, icon, keywords }) => ({
	id: `hub-web.open.${serviceId}`,
	title: `Hub: Open ${getWebService(serviceId)?.name ?? serviceId}`,
	room: 'hub',
	keywords: ['web', 'site', serviceId, ...keywords],
	icon,
	run: (ctx) => ctx.openPanel(`hub-web.${serviceId}`),
}));

export const rendererModule: RendererModule = { manifest, panels, commands };
