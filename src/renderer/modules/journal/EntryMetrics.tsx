import type { JSX } from 'react';

import type { JournalEntry } from '@shared/ipc/channels/journal';

import { cn } from '../../lib/cn';
import { entryPnl, entryR, plannedRR } from './journal-model';

export function formatMoney(v: number | null): string {
	if (v === null) return '—';
	// Float noise from price math (e.g. 1e-12) must not read as a win or a loss.
	if (Math.abs(v) < 0.005) return '0';
	const sign = v > 0 ? '+' : v < 0 ? '−' : '';
	return `${sign}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
}

export function formatR(v: number | null): string {
	return v === null ? '—' : `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}R`;
}

export const toneOf = (v: number | null): string =>
	v === null || Math.abs(v) < 0.005 ? 'text-fg-1' : v > 0 ? 'text-up' : 'text-down';

/** Live numbers under the form: what the entry will count as in the stats. */
export function EntryMetrics({ entry }: { entry: JournalEntry }): JSX.Element {
	const pnl = entryPnl(entry);
	const r = entryR(entry);
	const rr = plannedRR(entry);
	const items: Array<[string, string, string]> = [
		['P/L', formatMoney(pnl), toneOf(pnl)],
		['Result', formatR(r), toneOf(r)],
		['Planned R:R', rr === null ? '—' : `1:${rr.toFixed(2)}`, 'text-fg-1'],
	];
	return (
		<dl className='flex flex-wrap gap-x-6 gap-y-1 rounded-sm border border-border bg-bg-2 px-3 py-2'>
			{items.map(([label, value, tone]) => (
				<div key={label} className='flex items-baseline gap-2'>
					<dt className='text-11 text-fg-2'>{label}</dt>
					<dd className={cn('num text-13', tone)} data-journal-metric={label}>
						{value}
					</dd>
				</div>
			))}
			{entry.status === 'closed' && pnl === null && (
				<p className='w-full text-11 text-fg-2'>
					Add entry, exit and size (or a P/L override) to count this trade in the stats.
				</p>
			)}
		</dl>
	);
}
