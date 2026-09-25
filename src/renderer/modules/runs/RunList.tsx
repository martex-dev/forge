import { Trash2 } from 'lucide-react';
import { type JSX, type KeyboardEvent, useState } from 'react';

import type { Run } from '@shared/ipc/channels/lab';

import { cn } from '../../lib/cn';
import { formatAge } from '../../lib/format';
import { useNow } from '../../lib/use-now';
import { Button } from '../../ui/Button';
import { Dialog } from '../../ui/Dialog';
import { IconButton } from '../../ui/IconButton';
import { formatDuration } from './runs-model';
import { RunStatusDot } from './RunStatusDot';
import { useDeleteRun } from './use-runs';

interface RunListProps {
	runs: Run[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}

export function RunList({ runs, selectedId, onSelect }: RunListProps): JSX.Element {
	const now = useNow(1_000);
	const deleteRun = useDeleteRun();
	const [confirm, setConfirm] = useState<Run | null>(null);

	const onKeyDown = (e: KeyboardEvent): void => {
		if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
		e.preventDefault();
		const index = runs.findIndex((r) => r.id === selectedId);
		const next =
			runs[Math.min(runs.length - 1, Math.max(0, index + (e.key === 'ArrowDown' ? 1 : -1)))];
		if (next) {
			onSelect(next.id);
			document.getElementById(`run-${next.id}`)?.focus();
		}
	};

	return (
		<>
			<div
				role='listbox'
				aria-label='Runs'
				className='flex min-h-0 flex-col overflow-y-auto'
				onKeyDown={onKeyDown}
			>
				{runs.map((run) => {
					const selected = run.id === selectedId;
					const end = run.status === 'running' ? now : (run.endedAt ?? run.updatedAt);
					return (
						<div
							key={run.id}
							id={`run-${run.id}`}
							role='option'
							aria-selected={selected}
							tabIndex={selected ? 0 : -1}
							onClick={() => onSelect(run.id)}
							onKeyDown={(e) => {
								if (e.key === 'Delete') setConfirm(run);
							}}
							data-run={run.id}
							data-run-status={run.status}
							className={cn(
								'group flex cursor-default items-center gap-2 border-b border-border/60 px-3 py-2',
								'focus-visible:shadow-glow focus-visible:outline-none',
								selected ? 'bg-accent-soft' : 'hover:bg-bg-2',
							)}
						>
							<RunStatusDot status={run.status} />
							<div className='min-w-0 flex-1'>
								<div
									className='truncate text-13 font-medium text-fg-0'
									title={run.name}
								>
									{run.name}
								</div>
								<div className='num truncate text-11 text-fg-2'>
									{run.project ? `${run.project} · ` : ''}
									{formatAge(run.startedAt, now)} ago ·{' '}
									{formatDuration(end - run.startedAt)}
								</div>
							</div>
							<span className='num text-11 text-fg-2' title='Last step'>
								{run.lastStep ?? '—'}
							</span>
							<IconButton
								label='Delete run'
								size='sm'
								icon={<Trash2 size={12} />}
								className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
								onClick={(e) => {
									e.stopPropagation();
									setConfirm(run);
								}}
							/>
						</div>
					);
				})}
			</div>
			<Dialog
				open={confirm !== null}
				onOpenChange={(open) => !open && setConfirm(null)}
				title='Delete run?'
				description={
					confirm
						? `“${confirm.name}” and all its metrics will be removed. This can't be undone.`
						: undefined
				}
				width='sm'
				footer={
					<>
						<Button variant='ghost' onClick={() => setConfirm(null)}>
							Cancel
						</Button>
						<Button
							variant='danger'
							onClick={() => {
								if (confirm) deleteRun(confirm);
								setConfirm(null);
							}}
						>
							Delete
						</Button>
					</>
				}
			/>
		</>
	);
}
