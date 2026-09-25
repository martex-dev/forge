import { FolderOpen, FolderTree, FolderX } from 'lucide-react';

import { manifest } from '@shared/modules/explorer.manifest';

import { call } from '../../lib/ipc';
import type { RendererModule } from '../types';
import { ExplorerPanel } from './ExplorerPanel';
import { openFolderDialog } from './NoFolder';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'explorer.tree',
			title: 'Explorer',
			room: 'build',
			icon: FolderTree,
			component: ExplorerPanel,
			defaultOpen: true,
			position: 'left',
			initialSize: 260,
		},
	],
	commands: [
		{
			id: 'explorer.openFolder',
			title: 'Build: Open Folder…',
			room: 'build',
			shortcut: 'Ctrl+O',
			keywords: ['project', 'workspace', 'directory'],
			icon: FolderOpen,
			run: (ctx) => {
				ctx.switchRoom('build');
				openFolderDialog();
			},
		},
		{
			id: 'explorer.closeFolder',
			title: 'Build: Close Folder',
			room: 'build',
			icon: FolderX,
			run: () => void call('workspace:close'),
		},
		{
			id: 'explorer.focus',
			title: 'Build: Show Explorer',
			room: 'build',
			shortcut: 'Ctrl+Shift+E',
			icon: FolderTree,
			run: (ctx) => ctx.openPanel('explorer.tree'),
		},
	],
};
