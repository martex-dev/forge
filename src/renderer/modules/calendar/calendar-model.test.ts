import { describe, expect, it } from 'vitest';

import type { CalendarEvent } from '@shared/ipc/channels/calendar';

import {
	applyFilters,
	currenciesIn,
	formatCountdown,
	groupByDay,
	IMMINENT_MS,
	isImminent,
	nextEvent,
} from './calendar-model';

const at = (iso: string): number => new Date(iso).getTime();
const ev = (
	id: string,
	time: string,
	currency: string,
	impact: CalendarEvent['impact'],
): CalendarEvent => ({
	id,
	title: id,
	currency,
	time: at(time),
	impact,
	forecast: null,
	previous: null,
});

const events = [
	ev('nfp', '2026-09-25T12:30:00Z', 'USD', 'high'),
	ev('ifo', '2026-09-25T08:00:00Z', 'EUR', 'medium'),
	ev('cpi', '2026-09-26T12:30:00Z', 'USD', 'high'),
	ev('holiday', '2026-09-23T00:00:00Z', 'JPY', 'holiday'),
	ev('pmi', '2026-09-25T09:00:00Z', 'GBP', 'low'),
];

describe('calendar model', () => {
	it('filters by impact and currency', () => {
		expect(
			applyFilters(events, { impacts: ['high'], currencies: [] }).map((e) => e.id),
		).toEqual(['nfp', 'cpi']);
		expect(
			applyFilters(events, { impacts: ['high', 'medium'], currencies: ['EUR'] }).map(
				(e) => e.id,
			),
		).toEqual(['ifo']);
	});

	it('lists currencies present', () => {
		expect(currenciesIn(events)).toEqual(['EUR', 'GBP', 'JPY', 'USD']);
	});

	it('groups by local day in time order', () => {
		const groups = groupByDay(
			events.filter((e) => e.id !== 'holiday'),
			'en-GB',
		);
		expect(groups.map((g) => g.events.map((e) => e.id))).toEqual([
			['ifo', 'pmi', 'nfp'],
			['cpi'],
		]);
	});

	it('finds the next high-impact event after now', () => {
		expect(nextEvent(events, at('2026-09-25T10:00:00Z'))?.id).toBe('nfp');
		expect(nextEvent(events, at('2026-09-25T13:00:00Z'))?.id).toBe('cpi');
		expect(nextEvent(events, at('2026-09-27T00:00:00Z'))).toBeNull();
	});

	it('flags events within the next 30 minutes only', () => {
		const nfp = events[0];
		if (!nfp) throw new Error('fixture');
		expect(isImminent(nfp, nfp.time - IMMINENT_MS + 1000)).toBe(true);
		expect(isImminent(nfp, nfp.time - IMMINENT_MS - 1000)).toBe(false);
		expect(isImminent(nfp, nfp.time + 1)).toBe(false);
	});

	it('formats countdowns compactly', () => {
		expect(formatCountdown(45_000)).toBe('45s');
		expect(formatCountdown(12 * 60_000 + 9_000)).toBe('12m 09s');
		expect(formatCountdown(3 * 3_600_000 + 5 * 60_000)).toBe('3h 05m');
		expect(formatCountdown(2 * 86_400_000 + 4 * 3_600_000)).toBe('2d 4h');
		expect(formatCountdown(-5)).toBe('0s');
	});
});
