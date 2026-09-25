import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { GitStatus } from '@shared/ipc/channels/git';

import { useWorkspace } from '../../app/hooks/use-workspace';
import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';
import { toast } from '../../stores/toast-store';

export const GIT_STATUS_KEY = ['git', 'status'] as const;

/**
 * Repository status. Refreshed after Forge's own git operations, on file changes, and by a
 * slow poll — commits/checkouts made in a terminal only touch .git, which the watcher ignores.
 */
export function useGitStatus(): {
	status: GitStatus | undefined;
	isLoading: boolean;
	error: Error | null;
	refetch: () => void;
} {
	const client = useQueryClient();
	const { info } = useWorkspace();
	const query = useQuery({
		queryKey: [...GIT_STATUS_KEY, info.root],
		queryFn: () => call('git:status'),
		enabled: info.root !== null,
		refetchInterval: 5000,
		refetchIntervalInBackground: false,
	});
	const refresh = (): void => void client.invalidateQueries({ queryKey: GIT_STATUS_KEY });
	useForgeEvent('git:changed', refresh);
	useForgeEvent('fs:changed', refresh);
	return {
		status: query.data,
		isLoading: query.isLoading,
		error: query.error,
		refetch: () => void query.refetch(),
	};
}

export function useGitActions(): {
	stage: (paths: string[]) => void;
	unstage: (paths: string[]) => void;
	commit: (message: string) => Promise<boolean>;
	pull: () => void;
	push: () => void;
	busy: boolean;
} {
	const client = useQueryClient();
	const done = (): void => void client.invalidateQueries({ queryKey: GIT_STATUS_KEY });
	const fail = (what: string) => (error: Error) => toast.error(`${what} failed`, error.message);

	const stage = useMutation({
		mutationFn: (p: string[]) => call('git:stage', p),
		onSettled: done,
		onError: fail('Stage'),
	});
	const unstage = useMutation({
		mutationFn: (p: string[]) => call('git:unstage', p),
		onSettled: done,
		onError: fail('Unstage'),
	});
	const commit = useMutation({
		mutationFn: (message: string) => call('git:commit', { message }),
		onSuccess: ({ hash }) => toast.success('Committed', hash.slice(0, 7)),
		onSettled: done,
		onError: fail('Commit'),
	});
	const pull = useMutation({
		mutationFn: () => call('git:pull'),
		onSuccess: ({ summary }) => toast.success('Pulled', summary),
		onSettled: done,
		onError: fail('Pull'),
	});
	const push = useMutation({
		mutationFn: () => call('git:push'),
		onSuccess: ({ summary }) => toast.success('Pushed', summary),
		onSettled: done,
		onError: fail('Push'),
	});

	return {
		stage: stage.mutate,
		unstage: unstage.mutate,
		commit: (message) =>
			commit
				.mutateAsync(message)
				.then(() => true)
				.catch(() => false),
		pull: () => pull.mutate(),
		push: () => push.mutate(),
		busy: [stage, unstage, commit, pull, push].some((m) => m.isPending),
	};
}
