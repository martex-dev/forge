import { Code2 } from 'lucide-react';

import { manifest } from '@shared/modules/build-core.manifest';

import type { RendererModule } from '../types';
import { BuildWelcomePanel } from './BuildWelcomePanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'build-core.welcome',
			title: 'Welcome',
			room: 'build',
			icon: Code2,
			component: BuildWelcomePanel,
			defaultOpen: true,
		},
	],
	commands: [
		{
			id: 'build-core.showWelcome',
			title: 'Build: Show Welcome',
			room: 'build',
			icon: Code2,
			run: (ctx) => ctx.openPanel('build-core.welcome'),
		},
	],
};
