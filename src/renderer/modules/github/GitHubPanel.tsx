import { ExternalLink, Lock, RefreshCw } from 'lucide-react';
import type { JSX, ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Select } from '../../ui/Select';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { IssueList, PullList, RunList } from './GitHubLists';
import { RepoGate } from './RepoGate';
import { type ListState, repoKeyOf, useIssues, usePulls, useRepo, useRuns } from './use-github';

type Tab = 'pulls' | 'issues' | 'actions';
const TABS: Array<{ id: Tab; label: string }> = [
	{ id: 'pulls', label: 'Pull requests' },
	{ id: 'issues', label: 'Issues' },
	{ id: 'actions', label: 'Actions' },
];

function Body<T>({
	q,
	children,
}: {
	q: { data: T | undefined; isLoading: boolean; error: Error | null; refetch: () => void };
	children: (data: T) => ReactNode;
}): JSX.Element {
	if (q.isLoading) {
		return (
			<div className='flex h-24 items-center justify-center'>
				<Spinner label='Loading' />
			</div>
		);
	}
	if (q.error)
		return <ErrorState title='Request failed' message={q.error.message} onRetry={q.refetch} />;
	return <>{q.data !== undefined && children(q.data)}</>;
}

export function GitHubPanel({ params, setParams }: PanelProps): JSX.Element {
	const repoQuery = useRepo();
	const repoKey = repoKeyOf(repoQuery.data);
	const tab: Tab =
		params['tab'] === 'issues' || params['tab'] === 'actions' ? params['tab'] : 'pulls';
	const state: ListState =
		params['state'] === 'closed' || params['state'] === 'all' ? params['state'] : 'open';
	const pulls = usePulls(tab === 'pulls' ? repoKey : null, state);
	const issues = useIssues(tab === 'issues' ? repoKey : null, state);
	const runs = useRuns(tab === 'actions' ? repoKey : null);
	const active = tab === 'pulls' ? pulls : tab === 'issues' ? issues : runs;

	return (
		<RepoGate
			repo={repoQuery.data}
			isLoading={repoQuery.isLoading}
			error={repoQuery.error}
			onRetry={repoQuery.refetch}
		>
			{(repo) => (
				<div
					className='flex h-full flex-col bg-bg-1'
					data-github={`${repo.owner}/${repo.repo}`}
				>
					<header className='flex items-center gap-1 border-b border-border py-1 pr-1 pl-3'>
						<div className='min-w-0 flex-1 truncate text-13 font-medium text-fg-0'>
							{repo.owner}/{repo.repo}
							{repo.private && (
								<Lock
									size={11}
									className='ml-1 inline text-fg-2'
									aria-label='Private'
								/>
							)}
						</div>
						{active.isFetching && !active.isLoading && (
							<Spinner size={12} label='Refreshing' />
						)}
						<IconButton
							label='Refresh'
							size='sm'
							icon={<RefreshCw size={12} />}
							onClick={active.refetch}
						/>
						<IconButton
							label='Open on GitHub'
							size='sm'
							icon={<ExternalLink size={12} />}
							onClick={() =>
								call('app:openExternal', repo.url).catch(() =>
									toast.error('Could not open link'),
								)
							}
						/>
					</header>
					<div
						role='tablist'
						aria-label='GitHub views'
						className='flex border-b border-border'
					>
						{TABS.map((t) => (
							<button
								key={t.id}
								type='button'
								role='tab'
								aria-selected={tab === t.id}
								onClick={() => setParams({ tab: t.id })}
								className={cn(
									'h-7 flex-1 border-b-2 text-12 transition-colors transition-fast',
									'focus-visible:shadow-glow focus-visible:outline-none',
									tab === t.id
										? 'border-accent text-fg-0'
										: 'border-transparent text-fg-2 hover:text-fg-1',
								)}
							>
								{t.label}
							</button>
						))}
					</div>
					{tab !== 'actions' && (
						<div className='border-b border-border px-2 py-1'>
							<Select
								aria-label='State'
								className='h-6 w-28'
								value={state}
								onValueChange={(v) => setParams({ state: v })}
								options={[
									{ value: 'open', label: 'Open' },
									{ value: 'closed', label: 'Closed' },
									{ value: 'all', label: 'All' },
								]}
							/>
						</div>
					)}
					<div className='min-h-0 flex-1 overflow-y-auto'>
						{tab === 'pulls' && <Body q={pulls}>{(d) => <PullList pulls={d} />}</Body>}
						{tab === 'issues' && (
							<Body q={issues}>{(d) => <IssueList issues={d} />}</Body>
						)}
						{tab === 'actions' && <Body q={runs}>{(d) => <RunList runs={d} />}</Body>}
					</div>
				</div>
			)}
		</RepoGate>
	);
}
