import { ArrowDown, FileDiff, GitBranch, GitPullRequestArrow } from 'lucide-react';

import { manifest } from '@shared/modules/git.manifest';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import type { RendererModule } from '../types';
import { DiffPanel } from './DiffPanel';
import { GitPanel } from './GitPanel';
import { GitStatusItem } from './GitStatusItem';

const runGit =
	(label: string, op: () => Promise<{ summary: string }>) => async (): Promise<void> => {
		try {
			const { summary } = await op();
			toast.success(label, summary);
		} catch (error) {
			toast.error(`${label} failed`, error instanceof Error ? error.message : undefined);
		}
	};

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'git.changes',
			title: 'Source Control',
			room: 'build',
			icon: GitBranch,
			component: GitPanel,
			defaultOpen: true,
			tabWith: 'explorer.tree',
			position: 'left',
			initialSize: 260,
		},
		{
			id: 'git.diff',
			title: 'Diff',
			room: 'build',
			icon: FileDiff,
			component: DiffPanel,
			tabWith: 'editor.main',
		},
	],
	commands: [
		{
			id: 'git.show',
			title: 'Build: Show Source Control',
			room: 'build',
			shortcut: 'Ctrl+Shift+G',
			keywords: ['git', 'changes', 'commit', 'scm'],
			icon: GitBranch,
			run: (ctx) => ctx.openPanel('git.changes'),
		},
		{
			id: 'git.pull',
			title: 'Git: Pull',
			room: 'build',
			icon: ArrowDown,
			run: runGit('Pulled', () => call('git:pull')),
		},
		{
			id: 'git.push',
			title: 'Git: Push',
			room: 'build',
			icon: GitPullRequestArrow,
			run: runGit('Pushed', () => call('git:push')),
		},
	],
	statusItems: [{ id: 'git.branch', side: 'left', order: 0, component: GitStatusItem }],
};
