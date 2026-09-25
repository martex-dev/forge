import { BellOff, CheckCheck, Search, Trash2 } from 'lucide-react';
import { type JSX, type KeyboardEvent, type ReactNode, useMemo, useState } from 'react';

import { getManifest } from '@shared/modules';
import type { NotificationLevel } from '@shared/notifications';

import { cn } from '../../lib/cn';
import { useNow } from '../../lib/use-now';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import {
	collapseRepeats,
	countBySource,
	DEFAULT_FILTERS,
	filterNotifications,
	groupByDay,
	type InboxFilters,
	LEVELS,
} from './inbox-model';
import { LEVEL_STYLE, NotificationRow } from './NotificationRow';
import { useInboxActions, useNotifications } from './use-inbox';

// Core sources (sidecar, app) have no manifest: show their id, capitalised.
const moduleName = (id: string): string =>
	getManifest(id)?.name ?? id.charAt(0).toUpperCase() + id.slice(1);

function Chip({
	pressed,
	onClick,
	children,
}: {
	pressed: boolean;
	onClick: () => void;
	children: ReactNode;
}): JSX.Element {
	return (
		<button
			type='button'
			aria-pressed={pressed}
			onClick={onClick}
			className={cn(
				'flex h-6 items-center gap-1 rounded-sm border px-1.5 text-11 transition-colors transition-fast',
				'focus-visible:shadow-glow focus-visible:outline-none',
				pressed
					? 'border-accent/50 bg-accent-soft text-fg-0'
					: 'border-border text-fg-2 hover:border-border-strong hover:text-fg-1',
			)}
		>
			{children}
		</button>
	);
}

export function InboxPanel(): JSX.Element {
	const { list, isLoading, error, refetch } = useNotifications();
	const { markAllRead, clearRead, markRead, remove } = useInboxActions();
	const [filters, setFilters] = useState<InboxFilters>(DEFAULT_FILTERS);
	const now = useNow(30_000);
	const visible = useMemo(() => filterNotifications(list, filters), [list, filters]);
	const groups = useMemo(() => groupByDay(visible, now), [visible, now]);
	const sources = useMemo(() => countBySource(list), [list]);
	const unread = list.filter((n) => !n.read).length;

	const toggleLevel = (level: NotificationLevel): void =>
		setFilters((f) => ({
			...f,
			levels: f.levels.includes(level)
				? f.levels.filter((l) => l !== level)
				: [...f.levels, level],
		}));

	// ↑/↓ between rows, Delete removes the focused row (and its repeats).
	const onListKey = (e: KeyboardEvent<HTMLDivElement>): void => {
		const rows = [...e.currentTarget.querySelectorAll<HTMLElement>('[data-notification]')];
		const i = rows.indexOf(document.activeElement as HTMLElement);
		if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
			e.preventDefault();
			rows[
				Math.max(0, Math.min(rows.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)))
			]?.focus();
		} else if (e.key === 'Delete' && i >= 0) {
			e.preventDefault();
			remove((rows[i]?.dataset['ids'] ?? '').split(',').filter(Boolean));
			(rows[i + 1] ?? rows[i - 1])?.focus();
		}
	};

	let body: JSX.Element;
	if (isLoading) {
		body = (
			<div className='flex h-full items-center justify-center'>
				<Spinner label='Loading notifications' />
			</div>
		);
	} else if (error) {
		body = <ErrorState title='Inbox unavailable' message={error.message} onRetry={refetch} />;
	} else if (list.length === 0) {
		body = (
			<EmptyState
				icon={<BellOff size={20} />}
				title='All caught up'
				description='Modules post here: finished or failed training runs, sidecar problems, and more.'
			/>
		);
	} else if (groups.length === 0) {
		body = (
			<EmptyState
				title='Nothing matches'
				description='Try another level or module filter.'
				action={
					<Button size='sm' onClick={() => setFilters(DEFAULT_FILTERS)}>
						Reset filters
					</Button>
				}
			/>
		);
	} else {
		body = (
			<div className='min-h-0 flex-1 overflow-y-auto' onKeyDown={onListKey}>
				{groups.map((g) => (
					<section key={g.label} aria-label={g.label}>
						<h3 className='sticky top-0 z-10 border-b border-border bg-bg-1 px-3 py-1 text-11 font-medium tracking-wide text-fg-2 uppercase'>
							{g.label}
						</h3>
						<ul>
							{collapseRepeats(g.items).map((row) => (
								<NotificationRow
									key={row.n.id}
									row={row}
									moduleName={moduleName(row.n.module)}
									now={now}
									onMarkRead={markRead}
									onDelete={remove}
								/>
							))}
						</ul>
					</section>
				))}
			</div>
		);
	}

	return (
		<div className='flex h-full flex-col bg-bg-1' data-inbox>
			<div className='flex items-center gap-2 border-b border-border px-2 py-1.5'>
				<Input
					className='h-6 flex-1'
					leading={<Search size={12} />}
					value={filters.query}
					onChange={(e) => setFilters((f) => ({ ...f, query: e.target.value }))}
					placeholder='Search notifications'
					aria-label='Search notifications'
				/>
			</div>
			{sources.length > 1 && (
				<div
					className='flex flex-wrap gap-1 border-b border-border px-2 py-1.5'
					role='toolbar'
					aria-label='Sources'
				>
					<Chip
						pressed={filters.module === null}
						onClick={() => setFilters((f) => ({ ...f, module: null }))}
					>
						All
						<span className='num text-fg-2'>{list.length}</span>
					</Chip>
					{sources.map((s) => (
						<Chip
							key={s.module}
							pressed={filters.module === s.module}
							onClick={() =>
								setFilters((f) => ({
									...f,
									module: f.module === s.module ? null : s.module,
								}))
							}
						>
							{moduleName(s.module)}
							<span className='num text-fg-2'>{s.total}</span>
							{s.unread > 0 && <span className='num text-accent'>•{s.unread}</span>}
						</Chip>
					))}
				</div>
			)}
			<div
				className='flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5'
				role='toolbar'
				aria-label='Inbox filters'
			>
				{LEVELS.map((level) => {
					const { icon: Icon, className, label } = LEVEL_STYLE[level];
					return (
						<Chip
							key={level}
							pressed={filters.levels.includes(level)}
							onClick={() => toggleLevel(level)}
						>
							<Icon size={11} className={className} aria-hidden />
							{label}
						</Chip>
					);
				})}
				<Chip
					pressed={filters.unreadOnly}
					onClick={() => setFilters((f) => ({ ...f, unreadOnly: !f.unreadOnly }))}
				>
					Unread ({unread})
				</Chip>
				<div className='ml-auto flex gap-1'>
					<Button
						size='sm'
						variant='ghost'
						icon={<CheckCheck size={12} />}
						disabled={unread === 0}
						onClick={markAllRead}
					>
						Mark all read
					</Button>
					<Button
						size='sm'
						variant='ghost'
						icon={<Trash2 size={12} />}
						disabled={list.length === unread}
						onClick={clearRead}
					>
						Clear read
					</Button>
				</div>
			</div>
			{body}
		</div>
	);
}
