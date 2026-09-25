import {
	CheckCircle2,
	CircleDot,
	GitMerge,
	GitPullRequest,
	GitPullRequestClosed,
	Loader2,
	MessageSquare,
	XCircle,
} from 'lucide-react';
import type { JSX, ReactNode } from 'react';

import type { Issue, PullSummary, WorkflowRun } from '@shared/ipc/channels/github';

import { commandContext } from '../../app/commands/use-commands';
import { cn } from '../../lib/cn';
import { formatAge } from '../../lib/format';
import { call } from '../../lib/ipc';
import { useNow } from '../../lib/use-now';
import { toast } from '../../stores/toast-store';
import { Badge } from '../../ui/Badge';

function openExternal(url: string): void {
	call('app:openExternal', url).catch(() => toast.error('Could not open link'));
}

function Row({
	icon,
	title,
	meta,
	right,
	onClick,
	data,
}: {
	icon: ReactNode;
	title: ReactNode;
	meta: ReactNode;
	right?: ReactNode;
	onClick: () => void;
	data?: Record<string, string>;
}): JSX.Element {
	return (
		<li>
			<button
				type='button'
				onClick={onClick}
				className='flex w-full items-start gap-2 border-b border-border/60 px-3 py-1.5 text-left hover:bg-bg-2 focus-visible:shadow-glow focus-visible:outline-none'
				{...data}
			>
				<span className='mt-0.5 shrink-0'>{icon}</span>
				<span className='min-w-0 flex-1'>
					<span className='block truncate text-13 text-fg-0'>{title}</span>
					<span className='num block truncate text-11 text-fg-2'>{meta}</span>
				</span>
				{right}
			</button>
		</li>
	);
}

const PR_ICON: Record<PullSummary['state'], JSX.Element> = {
	open: <GitPullRequest size={14} className='text-up' />,
	merged: <GitMerge size={14} className='text-accent-lab' />,
	closed: <GitPullRequestClosed size={14} className='text-down' />,
};

export function PullList({ pulls }: { pulls: PullSummary[] }): JSX.Element {
	const now = useNow(60_000);
	if (pulls.length === 0) return <p className='p-3 text-12 text-fg-2'>No pull requests.</p>;
	return (
		<ul aria-label='Pull requests'>
			{pulls.map((p) => (
				<Row
					key={p.number}
					data={{ 'data-pr': String(p.number) }}
					icon={PR_ICON[p.state]}
					onClick={() =>
						commandContext.openPanel('github.pr', {
							title: `#${p.number}`,
							params: { number: p.number },
						})
					}
					title={
						<>
							{p.title}
							{p.draft && <span className='ml-1 text-fg-2'>(draft)</span>}
						</>
					}
					meta={`#${p.number} · ${p.author.login} · ${p.headRef} → ${p.baseRef} · ${formatAge(p.updatedAt, now)} ago`}
					right={
						<span className='flex shrink-0 flex-col items-end gap-1'>
							{p.reviewRequested && <Badge tone='accent'>review</Badge>}
							{p.comments > 0 && (
								<span className='num flex items-center gap-0.5 text-11 text-fg-2'>
									<MessageSquare size={10} /> {p.comments}
								</span>
							)}
						</span>
					}
				/>
			))}
		</ul>
	);
}

export function IssueList({ issues }: { issues: Issue[] }): JSX.Element {
	const now = useNow(60_000);
	if (issues.length === 0) return <p className='p-3 text-12 text-fg-2'>No issues.</p>;
	return (
		<ul aria-label='Issues'>
			{issues.map((i) => (
				<Row
					key={i.number}
					data={{ 'data-issue': String(i.number) }}
					icon={
						<CircleDot
							size={14}
							className={i.state === 'open' ? 'text-up' : 'text-fg-2'}
						/>
					}
					onClick={() => openExternal(i.url)}
					title={i.title}
					meta={`#${i.number} · ${i.author.login} · ${formatAge(i.updatedAt, now)} ago${i.assignees.length ? ` · → ${i.assignees.join(', ')}` : ''}`}
					right={
						i.labels.length > 0 ? (
							<span className='flex max-w-24 shrink-0 flex-wrap justify-end gap-0.5'>
								{i.labels.slice(0, 2).map((l) => (
									<span
										key={l.name}
										className='truncate rounded-full border px-1 text-11'
										style={{ borderColor: `#${l.color}`, color: `#${l.color}` }}
									>
										{l.name}
									</span>
								))}
							</span>
						) : undefined
					}
				/>
			))}
		</ul>
	);
}

function runIcon(run: WorkflowRun): JSX.Element {
	if (run.status !== 'completed') {
		return <Loader2 size={14} className='animate-spin text-warn motion-reduce:animate-none' />;
	}
	if (run.conclusion === 'success') return <CheckCircle2 size={14} className='text-up' />;
	if (run.conclusion === 'cancelled' || run.conclusion === 'skipped') {
		return <XCircle size={14} className='text-fg-2' />;
	}
	return <XCircle size={14} className='text-down' />;
}

export function RunList({ runs }: { runs: WorkflowRun[] }): JSX.Element {
	const now = useNow(30_000);
	if (runs.length === 0) return <p className='p-3 text-12 text-fg-2'>No workflow runs yet.</p>;
	return (
		<ul aria-label='Workflow runs'>
			{runs.map((r) => (
				<Row
					key={r.id}
					data={{ 'data-run-id': String(r.id) }}
					icon={runIcon(r)}
					onClick={() => openExternal(r.url)}
					title={r.title || r.name}
					meta={`${r.name} #${r.runNumber} · ${r.branch ?? ''} · ${r.event} · ${formatAge(r.createdAt, now)} ago`}
					right={
						<span
							className={cn(
								'num shrink-0 text-11',
								r.conclusion === 'failure' ? 'text-down' : 'text-fg-2',
							)}
						>
							{r.status === 'completed'
								? (r.conclusion ?? '')
								: r.status.replace('_', ' ')}
						</span>
					}
				/>
			))}
		</ul>
	);
}
