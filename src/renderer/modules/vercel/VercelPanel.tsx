import { ArrowLeft, KeyRound, Triangle } from 'lucide-react';
import type { JSX } from 'react';

import { commandContext } from '../../app/commands/use-commands';
import { formatAge } from '../../lib/format';
import { useNow } from '../../lib/use-now';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Select } from '../../ui/Select';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { StateDot, TargetBadge } from './DeploymentState';
import { useDeployments, useProjects, useSetTeam, useVercelStatus } from './use-vercel';

const PERSONAL = '__personal__';

function Loading({ label }: { label: string }): JSX.Element {
	return (
		<div className='flex h-24 items-center justify-center'>
			<Spinner label={label} />
		</div>
	);
}

function Deployments({ projectId }: { projectId: string }): JSX.Element {
	const q = useDeployments(projectId);
	const now = useNow(30_000);
	if (q.isLoading) return <Loading label='Loading deployments' />;
	if (q.error)
		return (
			<ErrorState
				title='Deployments unavailable'
				message={q.error.message}
				onRetry={q.refetch}
			/>
		);
	if (!q.data?.length) return <p className='p-3 text-12 text-fg-2'>No deployments yet.</p>;
	return (
		<ul aria-label='Deployments'>
			{q.data.map((d) => (
				<li key={d.id}>
					<button
						type='button'
						onClick={() =>
							commandContext.openPanel('vercel.deployment', {
								title: d.project,
								params: { projectId, deploymentId: d.id },
							})
						}
						className='flex w-full items-start gap-2 border-b border-border/60 px-3 py-1.5 text-left hover:bg-bg-2 focus-visible:shadow-glow focus-visible:outline-none'
						data-deployment={d.id}
						data-state={d.state}
					>
						<span className='mt-1.5'>
							<StateDot state={d.state} />
						</span>
						<span className='min-w-0 flex-1'>
							<span className='block truncate text-13 text-fg-0'>
								{d.commitMessage ?? d.url}
							</span>
							<span className='num block truncate text-11 text-fg-2'>
								{d.commitRef ?? '—'} · {formatAge(d.createdAt, now)} ago
								{d.creator ? ` · ${d.creator}` : ''}
							</span>
						</span>
						<TargetBadge d={d} />
					</button>
				</li>
			))}
		</ul>
	);
}

export function VercelPanel({ params, setParams }: PanelProps): JSX.Element {
	const status = useVercelStatus();
	const setTeam = useSetTeam();
	const ok = status.data?.status === 'ok';
	const projects = useProjects(ok);
	const now = useNow(60_000);
	const projectId = typeof params['projectId'] === 'string' ? params['projectId'] : null;
	const project = projects.data?.find((p) => p.id === projectId) ?? null;

	if (status.isLoading) return <Loading label='Connecting to Vercel' />;
	if (status.error) {
		return (
			<ErrorState
				title='Vercel unavailable'
				message={status.error.message}
				onRetry={status.refetch}
			/>
		);
	}
	if (status.data?.status !== 'ok') {
		return (
			<EmptyState
				icon={<KeyRound size={20} />}
				title='Connect Vercel'
				description='Add a Vercel token to see projects, deployments and logs.'
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
	const { user, teams, teamId } = status.data;
	return (
		<div className='flex h-full flex-col bg-bg-1' data-vercel>
			<header className='flex items-center gap-2 border-b border-border px-2 py-1'>
				<Triangle size={12} className='shrink-0 fill-fg-0 text-fg-0' aria-hidden />
				<Select
					aria-label='Vercel scope'
					className='h-6 flex-1'
					value={teamId ?? PERSONAL}
					onValueChange={(v) => {
						setParams({ projectId: undefined });
						setTeam(v === PERSONAL ? null : v);
					}}
					options={[
						{ value: PERSONAL, label: `${user} (personal)` },
						...teams.map((t) => ({ value: t.id, label: t.name })),
					]}
				/>
				{projects.isFetching && !projects.isLoading && (
					<Spinner size={12} label='Refreshing' />
				)}
			</header>
			{project ? (
				<>
					<div className='flex items-center gap-1 border-b border-border px-1 py-1'>
						<IconButton
							label='All projects'
							size='sm'
							icon={<ArrowLeft size={12} />}
							onClick={() => setParams({ projectId: undefined })}
						/>
						<span className='truncate text-13 font-medium text-fg-0'>
							{project.name}
						</span>
						{project.repo && (
							<span className='truncate text-11 text-fg-2'>{project.repo}</span>
						)}
					</div>
					<div className='min-h-0 flex-1 overflow-y-auto'>
						<Deployments projectId={project.id} />
					</div>
				</>
			) : projects.isLoading ? (
				<Loading label='Loading projects' />
			) : projects.error ? (
				<ErrorState
					title='Projects unavailable'
					message={projects.error.message}
					onRetry={projects.refetch}
				/>
			) : !projects.data?.length ? (
				<p className='p-3 text-12 text-fg-2'>No projects in this scope.</p>
			) : (
				<ul className='min-h-0 flex-1 overflow-y-auto' aria-label='Vercel projects'>
					{projects.data.map((p) => (
						<li key={p.id}>
							<button
								type='button'
								onClick={() => setParams({ projectId: p.id })}
								className='flex w-full items-start gap-2 border-b border-border/60 px-3 py-1.5 text-left hover:bg-bg-2 focus-visible:shadow-glow focus-visible:outline-none'
								data-project={p.name}
							>
								<span className='mt-1.5'>
									{p.production ? (
										<StateDot state={p.production.state} />
									) : (
										<span className='inline-block size-2' />
									)}
								</span>
								<span className='min-w-0 flex-1'>
									<span className='block truncate text-13 text-fg-0'>
										{p.name}
									</span>
									<span className='num block truncate text-11 text-fg-2'>
										{p.framework ?? 'other'}
										{p.production
											? ` · ${p.production.url.replace(/^https:\/\//, '')}`
											: ''}
										{p.updatedAt ? ` · ${formatAge(p.updatedAt, now)} ago` : ''}
									</span>
								</span>
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
