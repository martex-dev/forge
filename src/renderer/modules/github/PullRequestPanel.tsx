import { CheckCircle2, CircleDashed, ExternalLink, GitPullRequest, XCircle } from 'lucide-react';
import { type JSX, useMemo } from 'react';

import type { Check } from '@shared/ipc/channels/github';

import { call } from '../../lib/ipc';
import { renderMarkdown } from '../../lib/markdown/markdown';
import { toast } from '../../stores/toast-store';
import { Badge, type BadgeTone } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { PatchView } from './PatchView';
import { RepoGate } from './RepoGate';
import { repoKeyOf, usePull, useRepo } from './use-github';

import '../../lib/markdown/markdown.css';

const STATE_TONE: Record<string, BadgeTone> = { open: 'up', merged: 'accent', closed: 'down' };

function openExternal(url: string): void {
	call('app:openExternal', url).catch(() => toast.error('Could not open link'));
}

function CheckIcon({ check }: { check: Check }): JSX.Element {
	if (check.status !== 'completed') return <CircleDashed size={13} className='text-warn' />;
	if (
		check.conclusion === 'success' ||
		check.conclusion === 'neutral' ||
		check.conclusion === 'skipped'
	) {
		return <CheckCircle2 size={13} className='text-up' />;
	}
	return <XCircle size={13} className='text-down' />;
}

export function PullRequestPanel({ params }: PanelProps): JSX.Element {
	const number = typeof params['number'] === 'number' ? params['number'] : null;
	const repoQuery = useRepo();
	const pr = usePull(repoKeyOf(repoQuery.data), number);
	const bodyText = pr.data?.body ?? '';
	const body = useMemo(() => (bodyText ? renderMarkdown(bodyText) : ''), [bodyText]);

	if (number === null) {
		return (
			<EmptyState
				icon={<GitPullRequest size={20} />}
				title='No pull request selected'
				description='Pick one in the GitHub panel.'
			/>
		);
	}
	return (
		<RepoGate
			repo={repoQuery.data}
			isLoading={repoQuery.isLoading}
			error={repoQuery.error}
			onRetry={repoQuery.refetch}
		>
			{() => {
				if (pr.isLoading) {
					return (
						<div className='flex h-full items-center justify-center bg-bg-1'>
							<Spinner label='Loading pull request' />
						</div>
					);
				}
				if (pr.error || !pr.data) {
					return (
						<ErrorState
							title='Pull request unavailable'
							message={pr.error?.message ?? 'Not found'}
							onRetry={pr.refetch}
						/>
					);
				}
				const p = pr.data;
				const failing = p.checks.filter(
					(c) => c.status === 'completed' && c.conclusion === 'failure',
				).length;
				return (
					<div className='h-full overflow-y-auto bg-bg-1 p-4' data-pr-detail={p.number}>
						<header className='mb-3'>
							<div className='flex items-start gap-2'>
								<h2 className='min-w-0 flex-1 text-16 font-semibold text-fg-0'>
									{p.title}{' '}
									<span className='font-normal text-fg-2'>#{p.number}</span>
								</h2>
								<Button
									size='sm'
									icon={<ExternalLink size={12} />}
									onClick={() => openExternal(p.url)}
								>
									GitHub
								</Button>
							</div>
							<div className='mt-1 flex flex-wrap items-center gap-2 text-12 text-fg-2'>
								<Badge tone={STATE_TONE[p.state]}>
									{p.draft ? 'draft' : p.state}
								</Badge>
								<span>
									<b className='text-fg-1'>{p.author.login}</b> wants to merge{' '}
									<code className='text-fg-1'>{p.headRef}</code> into{' '}
									<code className='text-fg-1'>{p.baseRef}</code>
								</span>
								<span className='num'>
									<span className='text-up'>+{p.additions}</span>{' '}
									<span className='text-down'>-{p.deletions}</span> ·{' '}
									{p.changedFiles} files
								</span>
								{p.mergeable === false && <Badge tone='warn'>conflicts</Badge>}
							</div>
						</header>

						{p.checks.length > 0 && (
							<section
								className='mb-3 rounded-sm border border-border'
								aria-label='Checks'
							>
								<h3 className='border-b border-border px-2 py-1 text-12 font-medium text-fg-1'>
									Checks{' '}
									{failing > 0 && (
										<span className='text-down'>· {failing} failing</span>
									)}
								</h3>
								<ul>
									{p.checks.map((c) => (
										<li
											key={c.name}
											className='flex items-center gap-2 px-2 py-0.5 text-12'
										>
											<CheckIcon check={c} />
											<span className='min-w-0 flex-1 truncate text-fg-1'>
												{c.name}
											</span>
											<span className='text-11 text-fg-2'>
												{c.conclusion ?? c.status}
											</span>
											{c.url && (
												<button
													type='button'
													onClick={() => openExternal(c.url ?? '')}
													className='text-11 text-accent hover:underline'
												>
													details
												</button>
											)}
										</li>
									))}
								</ul>
							</section>
						)}

						{body ? (
							<article
								className='md-preview selectable mb-4 rounded-sm border border-border px-4 py-3'
								// Rendered with raw HTML disabled; see lib/markdown/markdown.ts.
								dangerouslySetInnerHTML={{ __html: body }}
								onClick={(e) => {
									const a = (e.target as HTMLElement).closest('a');
									if (!a) return;
									e.preventDefault();
									if (a.href.startsWith('https://')) openExternal(a.href);
								}}
							/>
						) : (
							<p className='mb-4 text-12 text-fg-2 italic'>No description.</p>
						)}

						<PatchView files={p.files} />
					</div>
				);
			}}
		</RepoGate>
	);
}
