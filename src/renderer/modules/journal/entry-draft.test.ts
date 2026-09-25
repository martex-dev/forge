import { describe, expect, it } from 'vitest';

import { fromDraft, fromLocalInput, toDraft, toLocalInput } from './entry-draft';
import { newEntry } from './journal-model';

const base = newEntry('00000000-0000-4000-8000-000000000000', 1_000, {
	symbol: 'eurusd',
	entry: 1.08,
	stop: 1.078,
	fees: 2,
	tags: ['london', 'a+'],
});

describe('entry draft', () => {
	it('round-trips an entry through the form', () => {
		const draft = toDraft(base);
		expect(draft.nums.entry).toBe('1.08');
		expect(draft.nums.exit).toBe('');
		expect(draft.tags).toBe('london, a+');
		const out = fromDraft(base, draft, 5_000);
		expect('entry' in out && out.entry).toMatchObject({
			symbol: 'EURUSD',
			entry: 1.08,
			exit: null,
			fees: 2,
			tags: ['london', 'a+'],
		});
	});

	it('reports the first invalid field', () => {
		const draft = toDraft(base);
		expect(fromDraft(base, { ...draft, symbol: ' ' }, 0)).toMatchObject({ field: 'symbol' });
		expect(fromDraft(base, { ...draft, nums: { ...draft.nums, size: '1x' } }, 0)).toMatchObject(
			{
				field: 'size',
			},
		);
	});

	it('stamps the close time when closing, and clears it otherwise', () => {
		const draft = toDraft(base);
		const closed = fromDraft(base, { ...draft, status: 'closed' }, 9_000);
		expect('entry' in closed && closed.entry.closedAt).toBe(9_000);
		const open = fromDraft(base, { ...draft, status: 'open', closedAt: '2026-01-01T10:00' }, 0);
		expect('entry' in open && open.entry.closedAt).toBeNull();
	});

	it('converts datetime-local values in local time', () => {
		const ms = new Date(2026, 8, 25, 14, 5).getTime();
		expect(toLocalInput(ms)).toBe('2026-09-25T14:05');
		expect(fromLocalInput('2026-09-25T14:05')).toBe(ms);
		expect(fromLocalInput('')).toBeNull();
	});
});
