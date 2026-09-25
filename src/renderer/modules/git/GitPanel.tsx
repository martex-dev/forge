import { ArrowDown, ArrowUp, GitBranch, GitPullRequestArrow, RefreshCw } from 'lucide-react';
import type { JSX } from 'react';

import type { GitChange } from '@shared/ipc/channels/git';

import { commandContext } from '../../app/commands/use-commands';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { ChangeList } from './ChangeList';
import { CommitBox } from './CommitBox';
import { useGitActions, useGitStatus } from './use-git';

export function openDiff(change: GitChange, staged: boolean): void {
	const name = change.path.split('/').at(-1) ?? change.path;
	commandContext.openPanel('git.diff', {
		title: `${name} (${staged ? 'staged' : 'changes'})`,
		params: {
			path: change.path,
			staged,
			kind: change.kind,
			workspacePath: change.workspacePath,
			...(change.from ? { from: change.from } : {}),
		},
	});
}

export function GitPanel(): JSX.Element {
	const { info } = useWorkspace();
	const { status, isLoading, error, refetch } = useGitStatus();
	const actions = useGitActions();

	if (!info.root) {
		return (
			<EmptyState
				icon={<GitBranch size={22} />}
				title='No folder open'
				description='Open a project to see its changes.'
			/>
		);
	}
	if (isLoading) {
		return (
			<div className='flex h-24 items-center justify-center'>
				<Spinner label='Reading repository' />
			</div>
		);
	}
	if (error) return <ErrorState title='Git failed' message={error.message} onRetry={refetch} />;
	if (!status?.isRepo) {
		return (
			<EmptyState
				icon={<GitBranch size={22} />}
				title='Not a git repository'
				description='Run `git init` in a terminal to start tracking this folder.'
			/>
		);
	}

	const clean = status.staged.length === 0 && status.unstaged.length === 0;
	return (
		<div className='flex h-full flex-col bg-bg-1'>
			<div className='flex h-7 shrink-0 items-center gap-1 border-b border-border pr-1 pl-2 text-12'>
				<GitBranch size={13} className='text-accent' />
				<span
					className='num min-w-0 flex-1 truncate text-fg-0'
					title={status.tracking ?? 'No upstream'}
				>
					{status.detached ? `(detached) ${status.branch ?? ''}` : status.branch}
				</span>
				{(status.ahead > 0 || status.behind > 0) && (
					<span
						className='num flex items-center gap-1 text-11 text-fg-1'
						title={`${status.behind} behind, ${status.ahead} ahead`}
					>
						<ArrowDown size={11} />
						{status.behind}
						<ArrowUp size={11} />
						{status.ahead}
					</span>
				)}
				<IconButton
					size='sm'
					label='Pull'
					icon={<ArrowDown size={13} />}
					disabled={actions.busy}
					onClick={actions.pull}
				/>
				<IconButton
					size='sm'
					label={status.tracking ? 'Push' : 'Publish Branch'}
					icon={<GitPullRequestArrow size={13} />}
					disabled={actions.busy}
					onClick={actions.push}
				/>
				<IconButton
					size='sm'
					label='Refresh'
					icon={<RefreshCw size={13} />}
					onClick={refetch}
				/>
			</div>
			<CommitBox
				branch={status.branch}
				stagedCount={status.staged.length}
				busy={actions.busy}
				onCommit={actions.commit}
			/>
			<div className='min-h-0 flex-1 overflow-auto pb-2'>
				{clean ? (
					<p className='px-3 py-4 text-center text-12 text-fg-2'>
						No changes. Working tree is clean.
					</p>
				) : (
					<>
						<ChangeList
							title='Staged Changes'
							changes={status.staged}
							staged
							busy={actions.busy}
							onOpen={(c) => openDiff(c, true)}
							onToggle={actions.unstage}
						/>
						<ChangeList
							title='Changes'
							changes={status.unstaged}
							staged={false}
							busy={actions.busy}
							onOpen={(c) => openDiff(c, false)}
							onToggle={actions.stage}
						/>
					</>
				)}
			</div>
		</div>
	);
}
