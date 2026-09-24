import { FlaskConical } from 'lucide-react';

import { manifest } from '@shared/modules/lab-core.manifest';

import type { RendererModule } from '../types';
import { LabWelcomePanel } from './LabWelcomePanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'lab-core.welcome',
			title: 'Welcome',
			room: 'lab',
			icon: FlaskConical,
			component: LabWelcomePanel,
			defaultOpen: true,
		},
	],
	commands: [
		{
			id: 'lab-core.showWelcome',
			title: 'Lab: Show Welcome',
			room: 'lab',
			icon: FlaskConical,
			run: (ctx) => ctx.openPanel('lab-core.welcome'),
		},
	],
};
