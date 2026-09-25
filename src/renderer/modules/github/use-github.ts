import { useQuery, useQueryClient } from '@tanstack/react-query';

import type {
	GitHubRepo,
	Issue,
	PullDetail,
	PullSummary,
	WorkflowRun,
} from '@shared/ipc/channels/github';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';
import { useUiStore } from '../../stores/ui-store';

export type ListState = 'open' | 'closed' | 'all';

interface Result<T> {
	data: T | undefined;
	isLoading: boolean;
	isFetching: boolean;
	error: Error | null;
	refetch: () => void;
}

function wrap<T>(q: {
	data: T | undefined;
	isLoading: boolean;
	isFetching: boolean;
	error: Error | null;
	refetch: () => unknown;
}): Result<T> {
	return {
		data: q.data,
		isLoading: q.isLoading,
		isFetching: q.isFetching,
		error: q.error,
		refetch: () => void q.refetch(),
	};
}

/** Repo of the open folder; refreshes when the folder or the GitHub token changes. */
export function useRepo(): Result<GitHubRepo> {
	const { info } = useWorkspace();
	const client = useQueryClient();
	useForgeEvent('secrets:changed', ({ key }) => {
		if (key === 'github.token') void client.invalidateQueries({ queryKey: ['github'] });
	});
	return wrap(
		useQuery({
			queryKey: ['github', 'repo', info.root],
			queryFn: () => call('github:repo'),
			staleTime: 5 * 60_000,
			retry: false,
		}),
	);
}

// Lists refresh on focus and every couple of minutes while the Build room is on screen.
function useListPolling(): number | false {
	const visible = useUiStore((s) => s.room === 'build');
	return visible ? 120_000 : false;
}

export function usePulls(repoKey: string | null, state: ListState): Result<PullSummary[]> {
	const interval = useListPolling();
	return wrap(
		useQuery({
			queryKey: ['github', 'pulls', repoKey, state],
			queryFn: () => call('github:pulls', { state }),
			enabled: repoKey !== null,
			refetchInterval: interval,
			retry: false,
		}),
	);
}

export function useIssues(repoKey: string | null, state: ListState): Result<Issue[]> {
	const interval = useListPolling();
	return wrap(
		useQuery({
			queryKey: ['github', 'issues', repoKey, state],
			queryFn: () => call('github:issues', { state }),
			enabled: repoKey !== null,
			refetchInterval: interval,
			retry: false,
		}),
	);
}

export function useRuns(repoKey: string | null): Result<WorkflowRun[]> {
	const visible = useUiStore((s) => s.room === 'build');
	return wrap(
		useQuery({
			queryKey: ['github', 'runs', repoKey],
			queryFn: () => call('github:runs'),
			enabled: repoKey !== null,
			// Runs change fast while CI is going; poll more often than PRs.
			refetchInterval: (q) =>
				!visible
					? false
					: q.state.data?.some((r) => r.status !== 'completed')
						? 15_000
						: 60_000,
			retry: false,
		}),
	);
}

export function usePull(repoKey: string | null, number: number | null): Result<PullDetail> {
	return wrap(
		useQuery({
			queryKey: ['github', 'pull', repoKey, number],
			queryFn: () => call('github:pull', { number: number ?? 0 }),
			enabled: repoKey !== null && number !== null,
			staleTime: 30_000,
			retry: false,
		}),
	);
}

export function repoKeyOf(repo: GitHubRepo | undefined): string | null {
	return repo?.status === 'ok' ? `${repo.owner}/${repo.repo}` : null;
}
