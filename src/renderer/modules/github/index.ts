import { GitPullRequest, GitPullRequestArrow, PlayCircle } from 'lucide-react';

import { manifest } from '@shared/modules/github.manifest';

import type { RendererModule } from '../types';
import { GitHubPanel } from './GitHubPanel';
import { PullRequestPanel } from './PullRequestPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'github.panel',
			title: 'GitHub',
			room: 'build',
			icon: GitPullRequestArrow,
			component: GitHubPanel,
			defaultOpen: true,
			tabWith: 'git.changes',
		},
		{
			id: 'github.pr',
			title: 'Pull request',
			room: 'build',
			icon: GitPullRequest,
			component: PullRequestPanel,
			tabWith: 'editor.main',
		},
	],
	commands: [
		{
			id: 'github.show',
			title: 'Build: Show GitHub Pull Requests',
			room: 'build',
			keywords: ['github', 'pr', 'pull request', 'review'],
			icon: GitPullRequestArrow,
			run: (ctx) => ctx.openPanel('github.panel', { params: { tab: 'pulls' } }),
		},
		{
			id: 'github.actions',
			title: 'Build: Show GitHub Actions',
			room: 'build',
			keywords: ['github', 'ci', 'workflow', 'build'],
			icon: PlayCircle,
			run: (ctx) => ctx.openPanel('github.panel', { params: { tab: 'actions' } }),
		},
	],
};
