import { Rocket, Triangle } from 'lucide-react';

import { manifest } from '@shared/modules/vercel.manifest';

import type { RendererModule } from '../types';
import { DeploymentPanel } from './DeploymentPanel';
import { VercelPanel } from './VercelPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'vercel.panel',
			title: 'Vercel',
			room: 'build',
			icon: Triangle,
			component: VercelPanel,
			defaultOpen: true,
			tabWith: 'github.panel',
		},
		{
			id: 'vercel.deployment',
			title: 'Deployment',
			room: 'build',
			icon: Rocket,
			component: DeploymentPanel,
			tabWith: 'editor.main',
		},
	],
	commands: [
		{
			id: 'vercel.show',
			title: 'Build: Show Vercel Deployments',
			room: 'build',
			keywords: ['vercel', 'deploy', 'deployment', 'logs', 'hosting'],
			icon: Triangle,
			run: (ctx) => ctx.openPanel('vercel.panel'),
		},
	],
};
