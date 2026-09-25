import { FilePlus2, FolderOpen, NotebookText } from 'lucide-react';

import { manifest } from '@shared/modules/notebooks.manifest';

import { call } from '../../lib/ipc';
import type { CommandContext, RendererModule } from '../types';
import { NotebookPanel } from './NotebookPanel';

const PANEL = 'notebooks.panel';

function instanceId(path: string): string {
	let hash = 2166136261;
	for (const ch of path.toLowerCase()) {
		hash ^= ch.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16777619) >>> 0;
	}
	return `${PANEL}#${hash.toString(36)}`;
}

/** One tab per notebook: opening it again focuses the tab (and its running kernel). */
export function openNotebook(ctx: CommandContext, path: string): void {
	ctx.openPanel(PANEL, {
		instanceId: instanceId(path),
		title: path.split(/[\\/]/).pop() ?? path,
		params: { path },
	});
}

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: PANEL,
			title: 'Notebook',
			room: 'lab',
			icon: NotebookText,
			component: NotebookPanel,
			tabWith: 'runs.monitor',
			// Kernels live in the sidecar: closing the tab shuts its kernel down.
			onClose: (params) => {
				const session = (params['session'] as { session?: string } | undefined)?.session;
				if (session) call('nb:shutdown', session).catch(() => undefined);
			},
		},
	],
	commands: [
		{
			id: 'notebooks.open',
			title: 'Lab: Open Notebook…',
			room: 'lab',
			keywords: ['jupyter', 'ipynb', 'kernel', 'notebook'],
			icon: FolderOpen,
			run: async (ctx) => {
				const path = await call('nb:pick');
				if (path) openNotebook(ctx, path);
			},
		},
		{
			id: 'notebooks.new',
			title: 'Lab: New Notebook…',
			room: 'lab',
			keywords: ['jupyter', 'ipynb', 'create'],
			icon: FilePlus2,
			run: async (ctx) => {
				const path = await call('nb:create');
				if (path) openNotebook(ctx, path);
			},
		},
		{
			id: 'notebooks.panel',
			title: 'Lab: Notebooks',
			room: 'lab',
			keywords: ['jupyter', 'recent', 'ipynb'],
			icon: NotebookText,
			run: (ctx) => ctx.openPanel(PANEL),
		},
	],
};
