import { BookOpenText, Plus, Search } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import type { JournalEntry } from '@shared/ipc/channels/journal';

import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { EntryForm } from './EntryForm';
import { EntryList } from './EntryList';
import { allTags, filterEntries, type JournalFilter } from './journal-model';
import { JournalStats } from './JournalStats';
import { useJournal } from './use-journal';

type View = 'entries' | 'stats';

/** Prefill passed by commands and other panels, e.g. a closed MT5 deal. */
export type JournalDraft = Partial<
	Pick<
		JournalEntry,
		| 'symbol'
		| 'market'
		| 'side'
		| 'status'
		| 'entry'
		| 'exit'
		| 'size'
		| 'pnl'
		| 'openedAt'
		| 'closedAt'
		| 'notes'
	>
>;

export function JournalPanel({ params, setParams }: PanelProps): JSX.Element {
	const journal = useJournal();
	const entries = useMemo(() => journal.data ?? [], [journal.data]);
	const view: View = params['view'] === 'stats' ? 'stats' : 'entries';
	const editing = typeof params['editing'] === 'string' ? params['editing'] : null;
	const draft = (params['draft'] ?? {}) as JournalDraft;
	const [filter, setFilter] = useState<JournalFilter>({ query: '', status: 'all', tag: null });
	const tags = useMemo(() => allTags(entries), [entries]);
	const shown = useMemo(() => filterEntries(entries, filter), [entries, filter]);

	if (journal.isPending) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Loading journal' />
			</div>
		);
	}
	if (journal.isError) {
		return (
			<ErrorState
				title='Journal unavailable'
				message={journal.error.message}
				onRetry={() => void journal.refetch()}
				className='h-full bg-bg-1'
			/>
		);
	}

	if (editing) {
		const existing = entries.find((e) => e.id === editing);
		return (
			<div className='flex h-full flex-col bg-bg-1'>
				<EntryForm
					key={editing}
					id={editing}
					existing={existing}
					draft={draft}
					onBack={() => setParams({ editing: undefined, draft: undefined })}
				/>
			</div>
		);
	}

	const create = (): void => setParams({ editing: crypto.randomUUID(), draft: undefined });

	return (
		<div className='flex h-full flex-col bg-bg-1' data-journal>
			<header className='flex flex-wrap items-center gap-2 border-b border-border px-2 py-1'>
				<div className='flex gap-1' role='tablist' aria-label='Journal view'>
					{(['entries', 'stats'] as const).map((v) => (
						<button
							key={v}
							type='button'
							role='tab'
							aria-selected={view === v}
							onClick={() => setParams({ view: v })}
							className={cn(
								'h-6 rounded-sm px-2 text-12 capitalize focus-visible:shadow-glow focus-visible:outline-none',
								view === v ? 'bg-bg-3 text-fg-0' : 'text-fg-2 hover:text-fg-1',
							)}
						>
							{v}
						</button>
					))}
				</div>
				<Input
					className='min-w-28 flex-1'
					leading={<Search size={12} />}
					value={filter.query}
					onChange={(e) => setFilter((f) => ({ ...f, query: e.target.value }))}
					placeholder='Symbol, setup, tag, notes'
					aria-label='Filter entries'
				/>
				<Select
					aria-label='Status'
					className='min-w-24'
					value={filter.status}
					onValueChange={(v) =>
						setFilter((f) => ({ ...f, status: v as JournalFilter['status'] }))
					}
					options={[
						{ value: 'all', label: 'All' },
						{ value: 'closed', label: 'Closed' },
						{ value: 'open', label: 'Open' },
						{ value: 'idea', label: 'Ideas' },
					]}
				/>
				{tags.length > 0 && (
					<Select
						aria-label='Tag'
						className='min-w-24'
						value={filter.tag ?? ''}
						onValueChange={(v) =>
							setFilter((f) => ({ ...f, tag: v === '*' ? null : v }))
						}
						placeholder='Any tag'
						options={[
							{ value: '*', label: 'Any tag' },
							...tags.map((t) => ({ value: t, label: `#${t}` })),
						]}
					/>
				)}
				<Button size='sm' icon={<Plus size={12} />} onClick={create}>
					New
				</Button>
			</header>
			{entries.length === 0 ? (
				<EmptyState
					icon={<BookOpenText size={20} />}
					title='No journal entries'
					description='Log trades and ideas with prices, tags, notes and screenshots (Ctrl+Alt+J from anywhere).'
					action={
						<Button
							size='sm'
							variant='primary'
							icon={<Plus size={12} />}
							onClick={create}
						>
							New entry
						</Button>
					}
				/>
			) : view === 'stats' ? (
				<JournalStats entries={shown} />
			) : shown.length === 0 ? (
				<EmptyState
					icon={<Search size={20} />}
					title='No matches'
					description='Change the filter.'
				/>
			) : (
				<EntryList entries={shown} onOpen={(id) => setParams({ editing: id })} />
			)}
		</div>
	);
}
