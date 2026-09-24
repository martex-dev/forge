import { Library } from 'lucide-react';

import { manifest } from '@shared/modules/hub-core.manifest';

import type { RendererModule } from '../types';
import { HubWelcomePanel } from './HubWelcomePanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'hub-core.welcome',
			title: 'Welcome',
			room: 'hub',
			icon: Library,
			component: HubWelcomePanel,
			defaultOpen: true,
		},
	],
	commands: [
		{
			id: 'hub-core.showWelcome',
			title: 'Hub: Show Welcome',
			room: 'hub',
			icon: Library,
			run: (ctx) => ctx.openPanel('hub-core.welcome'),
		},
	],
};
