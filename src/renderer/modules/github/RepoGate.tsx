import { FolderGit2, FolderOpen, KeyRound } from 'lucide-react';
import type { JSX, ReactNode } from 'react';

import type { GitHubRepo } from '@shared/ipc/channels/github';

import { commandContext } from '../../app/commands/use-commands';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';

/**
 * Shared "is GitHub usable here?" states for the GitHub panels: no folder, no GitHub remote,
 * no token, or an API error. Renders children only for a reachable repo.
 */
export function RepoGate({
	repo,
	isLoading,
	error,
	onRetry,
	children,
}: {
	repo: GitHubRepo | undefined;
	isLoading: boolean;
	error: Error | null;
	onRetry: () => void;
	children: (repo: Extract<GitHubRepo, { status: 'ok' }>) => ReactNode;
}): JSX.Element {
	if (isLoading) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Connecting to GitHub' />
			</div>
		);
	}
	if (error)
		return <ErrorState title='GitHub unavailable' message={error.message} onRetry={onRetry} />;
	if (!repo || repo.status === 'no-folder') {
		return (
			<EmptyState
				icon={<FolderOpen size={20} />}
				title='No folder open'
				description='Open a project folder whose git remote points to GitHub.'
			/>
		);
	}
	if (repo.status === 'no-remote') {
		return (
			<EmptyState
				icon={<FolderGit2 size={20} />}
				title='Not a GitHub repository'
				description='This folder has no git remote on github.com (origin or upstream).'
			/>
		);
	}
	if (repo.status === 'no-token') {
		return (
			<EmptyState
				icon={<KeyRound size={20} />}
				title={`Connect ${repo.owner}/${repo.repo}`}
				description='Add a GitHub token (read-only is enough) to see pull requests, issues and Actions.'
				action={
					<Button
						variant='primary'
						onClick={() => commandContext.openSettings('secrets')}
					>
						Open Settings → Secrets
					</Button>
				}
			/>
		);
	}
	return <>{children(repo)}</>;
}
