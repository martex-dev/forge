import { RotateCcw } from 'lucide-react';

import { manifest } from '@shared/modules/lsp.manifest';

import type { RendererModule } from '../types';
import { restart } from './lsp-clients';
import { LspController } from './LspController';
import { LspStatusItem } from './LspStatusItem';

export const rendererModule: RendererModule = {
	manifest,
	commands: [
		{
			id: 'lsp.restart',
			title: 'Build: Restart Language Servers',
			room: 'build',
			keywords: ['lsp', 'pyright', 'typescript', 'intellisense', 'diagnostics'],
			icon: RotateCcw,
			run: () => restart(['python', 'typescript']),
		},
	],
	statusItems: [{ id: 'lsp.status', side: 'right', order: 5, component: LspStatusItem }],
	overlays: [LspController],
};
