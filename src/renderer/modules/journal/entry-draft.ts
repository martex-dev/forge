import type { JournalEntry } from '@shared/ipc/channels/journal';

import { parseNum, parseTags } from './journal-model';

export const NUM_FIELDS = ['entry', 'stop', 'target', 'exit', 'size', 'pnl', 'fees'] as const;
export type NumField = (typeof NUM_FIELDS)[number];

/** Form state: numbers and dates stay as typed text until saved. */
export interface EntryDraft {
	symbol: string;
	market: JournalEntry['market'];
	side: JournalEntry['side'];
	status: JournalEntry['status'];
	nums: Record<NumField, string>;
	openedAt: string;
	closedAt: string;
	setup: string;
	tags: string;
	notes: string;
}

const pad = (n: number): string => String(n).padStart(2, '0');

/** Epoch ms → `datetime-local` value in local time. */
export function toLocalInput(ms: number | null): string {
	if (ms === null) return '';
	const d = new Date(ms);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromLocalInput(text: string): number | null {
	if (!text) return null;
	const ms = new Date(text).getTime();
	return Number.isFinite(ms) ? ms : null;
}

export function toDraft(e: JournalEntry): EntryDraft {
	const num = (v: number | null): string => (v === null ? '' : String(v));
	return {
		symbol: e.symbol,
		market: e.market,
		side: e.side,
		status: e.status,
		nums: {
			entry: num(e.entry),
			stop: num(e.stop),
			target: num(e.target),
			exit: num(e.exit),
			size: num(e.size),
			pnl: num(e.pnl),
			fees: e.fees === 0 ? '' : String(e.fees),
		},
		openedAt: toLocalInput(e.openedAt),
		closedAt: toLocalInput(e.closedAt),
		setup: e.setup,
		tags: e.tags.join(', '),
		notes: e.notes,
	};
}

/** Applies a draft onto the stored entry, or returns the first problem to show. */
export function fromDraft(
	base: JournalEntry,
	d: EntryDraft,
	now: number,
): { entry: JournalEntry } | { error: string; field?: NumField | 'symbol' } {
	const symbol = d.symbol.trim().toUpperCase();
	if (!symbol) return { error: 'Symbol is required', field: 'symbol' };
	const nums = {} as Record<NumField, number | null>;
	for (const f of NUM_FIELDS) {
		const v = parseNum(d.nums[f]);
		if (v === undefined) return { error: `${f} is not a number`, field: f };
		nums[f] = v;
	}
	let closedAt = fromLocalInput(d.closedAt);
	// Closing a trade stamps it, so it lands on the equity curve without extra typing.
	if (d.status === 'closed' && closedAt === null) closedAt = now;
	return {
		entry: {
			...base,
			symbol,
			market: d.market,
			side: d.side,
			status: d.status,
			...nums,
			fees: nums.fees ?? 0,
			openedAt: fromLocalInput(d.openedAt),
			closedAt: d.status === 'closed' ? closedAt : null,
			setup: d.setup.trim(),
			tags: parseTags(d.tags),
			notes: d.notes,
		},
	};
}
