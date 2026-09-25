import { FlaskConical, Gauge } from 'lucide-react';

import { manifest } from '@shared/modules/mltools.manifest';

import type { RendererModule } from '../types';
import { MlToolsPanel } from './MlToolsPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'mltools.panel',
			title: 'CV & Calibration',
			room: 'lab',
			icon: FlaskConical,
			component: MlToolsPanel,
			tabWith: 'runs.monitor',
		},
	],
	commands: [
		{
			id: 'mltools.cv',
			title: 'Lab: CV Folds Playground',
			room: 'lab',
			keywords: [
				'cross-validation',
				'purged',
				'embargo',
				'kfold',
				'leakage',
				'cv-visualizer',
			],
			icon: FlaskConical,
			run: (ctx) => ctx.openPanel('mltools.panel', { params: { tab: 'cv' } }),
		},
		{
			id: 'mltools.calibration',
			title: 'Lab: Calibration Report from File…',
			room: 'lab',
			keywords: ['calibrate', 'reliability', 'ece', 'brier', 'probability'],
			icon: Gauge,
			run: (ctx) => ctx.openPanel('mltools.panel', { params: { tab: 'calibration' } }),
		},
	],
};
