import { Image } from 'lucide-react';
import type { JSX } from 'react';

import type { JournalEntry } from '@shared/ipc/channels/journal';

import { cn } from '../../lib/cn';
import { formatMoney, formatR, toneOf } from './EntryMetrics';
import { entryPnl, entryR, entryTime } from './journal-model';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
	day: '2-digit',
	month: 'short',
	year: '2-digit',
});

const STATUS: Record<JournalEntry['status'], string> = {
	idea: 'idea',
	open: 'open',
	closed: '',
};

export function EntryList({
	entries,
	onOpen,
}: {
	entries: JournalEntry[];
	onOpen: (id: string) => void;
}): JSX.Element {
	const sorted = [...entries].sort((a, b) => entryTime(b) - entryTime(a));
	return (
		<ul className='min-h-0 flex-1 overflow-y-auto' aria-label='Journal entries'>
			{sorted.map((e) => {
				const pnl = entryPnl(e);
				const r = entryR(e);
				return (
					<li key={e.id} className='border-b border-border/60'>
						<button
							type='button'
							onClick={() => onOpen(e.id)}
							className='flex w-full items-center gap-3 px-3 py-1.5 text-left hover:bg-bg-3 focus-visible:bg-bg-3 focus-visible:outline-none'
							data-journal-entry={e.symbol}
						>
							<span
								className={cn(
									'w-9 shrink-0 text-11 uppercase',
									e.side === 'long' ? 'text-up' : 'text-down',
								)}
							>
								{e.side}
							</span>
							<span className='min-w-0 flex-1'>
								<span className='num flex items-center gap-2 text-13 text-fg-0'>
									{e.symbol}
									{STATUS[e.status] && (
										<span className='rounded-sm border border-border px-1 text-11 text-fg-2'>
											{STATUS[e.status]}
										</span>
									)}
									{e.images.length > 0 && (
										<Image
											size={11}
											className='text-fg-2'
											aria-label='Has screenshots'
										/>
									)}
								</span>
								<span className='block truncate text-11 text-fg-2'>
									{[e.setup, ...e.tags.map((t) => `#${t}`)]
										.filter(Boolean)
										.join(' · ') || '—'}
								</span>
							</span>
							<span className='flex shrink-0 flex-col items-end'>
								<span className={cn('num text-13', toneOf(pnl))}>
									{e.status === 'closed' ? formatMoney(pnl) : ''}
								</span>
								<span className='num text-11 text-fg-2'>
									{r !== null ? `${formatR(r)} · ` : ''}
									{dateFmt.format(entryTime(e))}
								</span>
							</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}
