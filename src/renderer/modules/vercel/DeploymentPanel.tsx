import { ExternalLink, Rocket, RotateCcw, Search } from 'lucide-react';
import { type JSX, useState } from 'react';

import type { Deployment } from '@shared/ipc/channels/vercel';

import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { StateDot, TargetBadge } from './DeploymentState';
import { LogView } from './LogView';
import {
	isActive,
	useBuildLogs,
	useDeployAction,
	useDeployments,
	useRuntimeLogs,
} from './use-vercel';

function openExternal(url: string): void {
	call('app:openExternal', url).catch(() => toast.error('Could not open link'));
}

type Action = 'promote' | 'rollback';

function ConfirmDeploy({
	action,
	d,
	onCancel,
	onConfirm,
}: {
	action: Action;
	d: Deployment;
	onCancel: () => void;
	onConfirm: () => void;
}): JSX.Element {
	const rows: Array<[string, string]> = [
		['Project', d.project],
		['Deployment', d.url.replace(/^https:\/\//, '')],
		['Commit', d.commitMessage ?? '—'],
		['Branch', d.commitRef ?? '—'],
		['Created', new Date(d.createdAt).toLocaleString()],
	];
	return (
		<Dialog
			open
			onOpenChange={(open) => !open && onCancel()}
			title={action === 'promote' ? 'Promote to production?' : 'Roll back production?'}
			description={
				action === 'promote'
					? 'This deployment will start serving your production domains.'
					: 'Production traffic will switch back to this deployment.'
			}
			footer={
				<>
					<Button variant='ghost' onClick={onCancel}>
						Cancel
					</Button>
					<Button variant='danger' onClick={onConfirm}>
						{action === 'promote' ? 'Promote' : 'Roll back'}
					</Button>
				</>
			}
		>
			<table className='w-full text-12' data-confirm={action}>
				<tbody>
					{rows.map(([k, v]) => (
						<tr key={k}>
							<td className='w-24 py-0.5 pr-2 align-top text-fg-2'>{k}</td>
							<td className='selectable py-0.5 break-all text-fg-0'>{v}</td>
						</tr>
					))}
				</tbody>
			</table>
		</Dialog>
	);
}

export function DeploymentPanel({ params }: PanelProps): JSX.Element {
	const projectId = typeof params['projectId'] === 'string' ? params['projectId'] : null;
	const deploymentId = typeof params['deploymentId'] === 'string' ? params['deploymentId'] : null;
	const list = useDeployments(projectId);
	const d = list.data?.find((x) => x.id === deploymentId) ?? null;
	const building = d ? isActive(d) : false;
	const [tab, setTab] = useState<'build' | 'runtime'>('build');
	const build = useBuildLogs(deploymentId, building);
	const runtime = useRuntimeLogs(projectId, deploymentId, tab === 'runtime');
	const { run, pending } = useDeployAction();
	const [confirm, setConfirm] = useState<Action | null>(null);

	if (!projectId || !deploymentId) {
		return (
			<EmptyState
				title='No deployment selected'
				description='Pick one in the Vercel panel.'
			/>
		);
	}
	if (list.isLoading) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Loading deployment' />
			</div>
		);
	}
	if (list.error || !d) {
		return (
			<ErrorState
				title='Deployment unavailable'
				message={list.error?.message ?? 'It is no longer among the recent deployments.'}
				onRetry={list.refetch}
			/>
		);
	}
	const canPromote = d.target === 'preview' && d.state === 'READY';
	const canRollback = d.target === 'production' && d.state === 'READY' && !d.isCurrentProduction;
	const logs = tab === 'build' ? build : runtime;

	return (
		<div className='flex h-full flex-col bg-bg-1' data-deployment-detail={d.id}>
			<header className='border-b border-border px-4 py-3'>
				<div className='flex items-center gap-2'>
					<StateDot state={d.state} />
					<h2 className='min-w-0 flex-1 truncate text-16 font-semibold text-fg-0'>
						{d.project}
					</h2>
					<TargetBadge d={d} />
				</div>
				<p className='mt-1 truncate text-13 text-fg-1'>{d.commitMessage ?? '—'}</p>
				<p className='num mt-0.5 text-11 text-fg-2'>
					{d.state.toLowerCase()} · {d.commitRef ?? '—'} ·{' '}
					{new Date(d.createdAt).toLocaleString()}
					{d.creator ? ` · ${d.creator}` : ''}
				</p>
				<div className='mt-2 flex flex-wrap gap-2'>
					<Button
						size='sm'
						icon={<ExternalLink size={12} />}
						onClick={() => openExternal(d.url)}
					>
						Visit
					</Button>
					{d.inspectorUrl && (
						<Button
							size='sm'
							variant='ghost'
							icon={<Search size={12} />}
							onClick={() => openExternal(d.inspectorUrl ?? '')}
						>
							Inspect on Vercel
						</Button>
					)}
					{canPromote && (
						<Button
							size='sm'
							icon={<Rocket size={12} />}
							disabled={pending}
							onClick={() => setConfirm('promote')}
						>
							Promote to production…
						</Button>
					)}
					{canRollback && (
						<Button
							size='sm'
							icon={<RotateCcw size={12} />}
							disabled={pending}
							onClick={() => setConfirm('rollback')}
						>
							Roll back to this…
						</Button>
					)}
				</div>
			</header>
			<div role='tablist' aria-label='Logs' className='flex border-b border-border'>
				{(['build', 'runtime'] as const).map((t) => (
					<button
						key={t}
						type='button'
						role='tab'
						aria-selected={tab === t}
						onClick={() => setTab(t)}
						className={cn(
							'h-7 px-4 text-12 border-b-2 focus-visible:shadow-glow focus-visible:outline-none',
							tab === t
								? 'border-accent text-fg-0'
								: 'border-transparent text-fg-2 hover:text-fg-1',
						)}
					>
						{t === 'build' ? 'Build logs' : 'Runtime logs'}
					</button>
				))}
				{tab === 'runtime' && (
					<button
						type='button'
						onClick={runtime.refetch}
						className='ml-auto px-3 text-11 text-accent hover:underline'
					>
						{runtime.isFetching ? 'Sampling…' : 'Refresh'}
					</button>
				)}
			</div>
			{logs.isLoading ? (
				<div className='flex flex-1 items-center justify-center'>
					<Spinner label='Loading logs' />
				</div>
			) : logs.error ? (
				<ErrorState
					title='Logs unavailable'
					message={logs.error.message}
					onRetry={logs.refetch}
				/>
			) : (
				<LogView
					lines={logs.data ?? []}
					follow={tab === 'build' && building}
					label={tab === 'build' ? 'Build logs' : 'Runtime logs'}
				/>
			)}
			{confirm && (
				<ConfirmDeploy
					action={confirm}
					d={d}
					onCancel={() => setConfirm(null)}
					onConfirm={() => {
						run(confirm, d);
						setConfirm(null);
					}}
				/>
			)}
		</div>
	);
}
