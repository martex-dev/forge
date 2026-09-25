import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { Deployment, LogLine, VercelProject, VercelStatus } from '@shared/ipc/channels/vercel';

import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';
import { toast } from '../../stores/toast-store';
import { useUiStore } from '../../stores/ui-store';

export interface Q<T> {
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
}): Q<T> {
	return {
		data: q.data,
		isLoading: q.isLoading,
		isFetching: q.isFetching,
		error: q.error,
		refetch: () => void q.refetch(),
	};
}

const ACTIVE = new Set(['QUEUED', 'INITIALIZING', 'BUILDING']);
export const isActive = (d: Deployment): boolean => ACTIVE.has(d.state);

export function useVercelStatus(): Q<VercelStatus> {
	const client = useQueryClient();
	useForgeEvent('secrets:changed', ({ key }) => {
		if (key === 'vercel.token') void client.invalidateQueries({ queryKey: ['vercel'] });
	});
	return wrap(
		useQuery({
			queryKey: ['vercel', 'status'],
			queryFn: () => call('vercel:status'),
			retry: false,
			staleTime: 5 * 60_000,
		}),
	);
}

export function useSetTeam(): (teamId: string | null) => void {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (teamId: string | null) => call('vercel:setTeam', { teamId }),
		onSuccess: () => void client.invalidateQueries({ queryKey: ['vercel'] }),
		onError: (e) => toast.error('Could not switch team', e.message),
	}).mutate;
}

export function useProjects(enabled: boolean): Q<VercelProject[]> {
	const visible = useUiStore((s) => s.room === 'build');
	return wrap(
		useQuery({
			queryKey: ['vercel', 'projects'],
			queryFn: () => call('vercel:projects'),
			enabled,
			refetchInterval: visible ? 120_000 : false,
			retry: false,
		}),
	);
}

export function useDeployments(projectId: string | null): Q<Deployment[]> {
	const visible = useUiStore((s) => s.room === 'build');
	return wrap(
		useQuery({
			queryKey: ['vercel', 'deployments', projectId],
			queryFn: () => call('vercel:deployments', { projectId: projectId ?? '' }),
			enabled: projectId !== null,
			// Fast while something builds so the status flips promptly.
			refetchInterval: (q) =>
				!visible ? false : q.state.data?.some(isActive) ? 5_000 : 60_000,
			retry: false,
		}),
	);
}

export function useBuildLogs(deploymentId: string | null, building: boolean): Q<LogLine[]> {
	return wrap(
		useQuery({
			queryKey: ['vercel', 'build-logs', deploymentId],
			queryFn: () => call('vercel:buildLogs', { deploymentId: deploymentId ?? '' }),
			enabled: deploymentId !== null,
			refetchInterval: building ? 3_000 : false,
			retry: false,
		}),
	);
}

export function useRuntimeLogs(
	projectId: string | null,
	deploymentId: string | null,
	enabled: boolean,
): Q<LogLine[]> {
	return wrap(
		useQuery({
			queryKey: ['vercel', 'runtime-logs', deploymentId],
			queryFn: () =>
				call('vercel:runtimeLogs', {
					projectId: projectId ?? '',
					deploymentId: deploymentId ?? '',
				}),
			enabled: enabled && projectId !== null && deploymentId !== null,
			retry: false,
			staleTime: 0,
		}),
	);
}

export function useDeployAction(): {
	run: (action: 'promote' | 'rollback', d: Deployment) => void;
	pending: boolean;
} {
	const client = useQueryClient();
	const mutation = useMutation({
		mutationFn: ({ action, d }: { action: 'promote' | 'rollback'; d: Deployment }) =>
			call(action === 'promote' ? 'vercel:promote' : 'vercel:rollback', {
				projectId: d.projectId ?? '',
				deploymentId: d.id,
			}),
		onSuccess: (_v, { action, d }) => {
			toast.success(action === 'promote' ? 'Promotion started' : 'Rollback started', d.url);
			void client.invalidateQueries({ queryKey: ['vercel'] });
		},
		onError: (e, { action }) =>
			toast.error(action === 'promote' ? 'Promote failed' : 'Rollback failed', e.message),
	});
	return { run: (action, d) => mutation.mutate({ action, d }), pending: mutation.isPending };
}
