import { Activity, GitPullRequestArrow, Inbox, NotebookPen } from 'lucide-react';
import type { JSX } from 'react';

import { runCommandById } from '../../app/commands/use-commands';
import { openNotification } from '../../app/notifications';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { Button } from '../../ui/Button';
import { deploysNeedingAttention, failingWorkflows, runsToday } from './today-model';
import { Muted, TodayCard } from './TodayCard';
import { useSource } from './use-today';

export function LabCard({
	runsOn,
	gpuOn,
	now,
}: {
	runsOn: boolean;
	gpuOn: boolean;
	now: number;
}): JSX.Element | null {
	const runs = useSource<'runs:list'>(['runs', 'list'], runsOn, () => call('runs:list'), true);
	const gpu = useSource<'gpu:snapshot'>(
		['gpu', 'snapshot'],
		gpuOn,
		() => call('gpu:snapshot'),
		true,
	);
	if (!runsOn && !gpuOn) return null;
	const s = runsToday(runs.data ?? [], now);
	const card = gpu.data?.gpus[0];
	return (
		<TodayCard
			title='Lab'
			icon={Activity}
			panelId='runs.monitor'
			query={runsOn ? runs : undefined}
			accent={card?.utilization != null ? `GPU ${card.utilization}%` : undefined}
		>
			{s.running.length === 0 && s.finished === 0 && s.failed.length === 0 ? (
				<Muted>No training runs in the last 24 h.</Muted>
			) : (
				<ul className='flex flex-col gap-1'>
					{s.running.map((r) => (
						<li key={r.id} className='flex gap-2'>
							<span className='size-1.5 translate-y-1.5 rounded-full bg-accent' />
							<span className='truncate text-fg-0'>{r.name}</span>
							<span className='num ml-auto text-fg-2'>step {r.lastStep ?? 0}</span>
						</li>
					))}
					<li className='text-fg-1'>
						{s.finished} finished
						{s.failed.length > 0 && (
							<span className='text-down'>
								{' '}
								· {s.failed.length} failed ({s.failed.map((r) => r.name).join(', ')}
								)
							</span>
						)}
					</li>
				</ul>
			)}
		</TodayCard>
	);
}

export function BuildCard({
	githubOn,
	vercelOn,
}: {
	githubOn: boolean;
	vercelOn: boolean;
}): JSX.Element | null {
	const repo = useSource<'github:repo'>(['today', 'github', 'repo'], githubOn, () =>
		call('github:repo'),
	);
	const ok = repo.data?.status === 'ok';
	const pulls = useSource<'github:pulls'>(['today', 'github', 'pulls'], githubOn && ok, () =>
		call('github:pulls', { state: 'open' }),
	);
	const actions = useSource<'github:runs'>(['today', 'github', 'runs'], githubOn && ok, () =>
		call('github:runs'),
	);
	const vercel = useSource<'vercel:status'>(['vercel', 'status'], vercelOn, () =>
		call('vercel:status'),
	);
	const projects = useSource<'vercel:projects'>(
		['vercel', 'projects'],
		vercelOn && vercel.data?.status === 'ok',
		() => call('vercel:projects'),
	);
	if (!githubOn && !vercelOn) return null;
	const failing = failingWorkflows(actions.data ?? []);
	const deploys = deploysNeedingAttention(projects.data ?? []);
	return (
		<TodayCard
			title='Build'
			icon={GitPullRequestArrow}
			panelId='github.panel'
			accent={
				failing.length + deploys.length > 0 ? (
					<span className='text-down'>needs attention</span>
				) : undefined
			}
		>
			<ul className='flex flex-col gap-1'>
				{githubOn && (
					<li className='text-fg-1'>
						{!repo.data
							? 'GitHub…'
							: ok
								? `${pulls.data?.length ?? '…'} open pull requests`
								: 'GitHub: open a folder with a GitHub remote and add a token'}
					</li>
				)}
				{failing.map((r) => (
					<li key={r.id} className='truncate text-down'>
						✗ {r.name} failed on {r.branch ?? 'main'}
					</li>
				))}
				{vercelOn && vercel.data?.status === 'no-token' && (
					<li className='text-fg-2'>Vercel: add a token in Settings → Secrets</li>
				)}
				{deploys.map((p) => (
					<li
						key={p.id}
						className={cn(
							'truncate',
							p.production?.state === 'ERROR' ? 'text-down' : 'text-warn',
						)}
					>
						{p.name}: production {p.production?.state.toLowerCase()}
					</li>
				))}
				{vercelOn && projects.data && deploys.length === 0 && (
					<li className='text-fg-2'>All production deploys ready</li>
				)}
			</ul>
		</TodayCard>
	);
}

export function InboxCard({ enabled }: { enabled: boolean }): JSX.Element | null {
	const list = useSource<'notifications:list'>(['notifications', 'list'], enabled, () =>
		call('notifications:list'),
	);
	if (!enabled) return null;
	const unread = (list.data ?? []).filter((n) => !n.read);
	return (
		<TodayCard
			title='Inbox'
			icon={Inbox}
			panelId='inbox.main'
			query={list}
			accent={
				unread.length ? (
					<span className='text-accent'>{unread.length} unread</span>
				) : undefined
			}
		>
			{unread.length === 0 ? (
				<Muted>All caught up.</Muted>
			) : (
				<ul className='flex flex-col gap-1'>
					{unread.slice(0, 4).map((n) => (
						<li key={n.id}>
							<button
								type='button'
								className='w-full truncate text-left text-fg-0 hover:text-accent focus-visible:shadow-glow focus-visible:outline-none'
								onClick={() => openNotification(n)}
							>
								{n.title}
							</button>
						</li>
					))}
				</ul>
			)}
		</TodayCard>
	);
}

export function NotesCard({ enabled }: { enabled: boolean }): JSX.Element | null {
	if (!enabled) return null;
	return (
		<TodayCard title='Notes' icon={NotebookPen} panelId='vault.sidebar'>
			<div className='flex flex-col items-start gap-2'>
				<Muted>Capture a thought into today’s daily note.</Muted>
				<Button
					size='sm'
					icon={<NotebookPen size={12} />}
					onClick={() => runCommandById('vault.quickNote')}
					title='Ctrl+Alt+N'
				>
					Quick note
				</Button>
			</div>
		</TodayCard>
	);
}
