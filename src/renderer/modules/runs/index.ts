import { Activity, Copy } from 'lucide-react';

import { manifest } from '@shared/modules/runs.manifest';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import type { RendererModule } from '../types';
import { RunMonitorPanel } from './RunMonitorPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'runs.monitor',
			title: 'Run Monitor',
			room: 'lab',
			icon: Activity,
			component: RunMonitorPanel,
			defaultOpen: true,
			// A tab in the centre group, in front of Welcome (tabWith would open it in the background).
			position: 'tab',
		},
	],
	commands: [
		{
			id: 'runs.show',
			title: 'Lab: Show Run Monitor',
			room: 'lab',
			keywords: ['training', 'metrics', 'loss', 'probe', 'experiment'],
			icon: Activity,
			run: (ctx) => ctx.openPanel('runs.monitor'),
		},
		{
			id: 'runs.copyInstall',
			title: 'Lab: Copy forge-probe Install Command',
			room: 'lab',
			keywords: ['pip', 'install', 'probe'],
			icon: Copy,
			run: async () => {
				const { packageDir } = await call('runs:setup');
				if (!packageDir) {
					toast.warn(
						'forge-probe not found',
						'It ships with the Forge repo (packages/forge-probe).',
					);
					return;
				}
				await navigator.clipboard.writeText(`pip install -e "${packageDir}"`);
				toast.success('Copied', 'Paste it into your training environment’s terminal.');
			},
		},
	],
};
