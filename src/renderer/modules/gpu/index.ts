import { Cpu } from 'lucide-react';

import { manifest } from '@shared/modules/gpu.manifest';

import type { RendererModule } from '../types';
import { GpuPanel } from './GpuPanel';
import { GpuStatusItem } from './GpuStatusItem';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'gpu.monitor',
			title: 'GPU',
			room: 'lab',
			icon: Cpu,
			component: GpuPanel,
			defaultOpen: true,
			position: 'right',
			initialSize: 340,
		},
	],
	commands: [
		{
			id: 'gpu.show',
			title: 'Lab: Show GPU Monitor',
			room: 'lab',
			keywords: ['gpu', 'vram', 'nvidia', 'cuda', 'temperature'],
			icon: Cpu,
			run: (ctx) => ctx.openPanel('gpu.monitor'),
		},
	],
	statusItems: [{ id: 'gpu.status', side: 'right', order: 20, component: GpuStatusItem }],
};
