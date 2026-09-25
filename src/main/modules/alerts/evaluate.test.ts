import { describe, expect, it } from 'vitest';

import type { CalendarAlert, PriceAlert } from '@shared/ipc/channels/alerts';

import { type CalendarEventLike, crossed, dueEvents, firedKey, formatValue } from './evaluate';

const price = (op: 'above' | 'below', value: number): PriceAlert => ({
	id: '11111111-1111-4111-8111-111111111111',
	kind: 'price',
	enabled: true,
	createdAt: 0,
	lastFiredAt: null,
	source: { kind: 'binance', symbol: 'BTCUSDT' },
	op,
	value,
	repeat: 'once',
	note: '',
});

describe('crossed', () => {
	it('fires only on a cross in the chosen direction', () => {
		const up = price('above', 100);
		expect(crossed(up, null, 150)).toBe(false); // first look: just arm
		expect(crossed(up, 99, 100)).toBe(true);
		expect(crossed(up, 101, 150)).toBe(false); // already above: no new cross
		expect(crossed(up, 150, 90)).toBe(false); // wrong direction
		const down = price('below', 100);
		expect(crossed(down, 101, 99.5)).toBe(true);
		expect(crossed(down, 99, 98)).toBe(false);
	});
});

describe('dueEvents', () => {
	const alert: CalendarAlert = {
		id: '22222222-2222-4222-8222-222222222222',
		kind: 'calendar',
		enabled: true,
		createdAt: 0,
		lastFiredAt: null,
		minutesBefore: 15,
		impacts: ['high'],
		currencies: ['usd'],
	};
	const now = 1_000_000_000_000;
	const event = (
		id: string,
		minutes: number,
		extra: Partial<CalendarEventLike> = {},
	): CalendarEventLike => ({
		id,
		title: id,
		currency: 'USD',
		impact: 'high',
		time: now + minutes * 60_000,
		forecast: null,
		previous: null,
		...extra,
	});

	it('returns events entering the window, filtered by impact and currency, once', () => {
		const events = [
			event('nfp', 10),
			event('later', 30),
			event('past', -1),
			event('eur', 5, { currency: 'EUR' }),
			event('medium', 5, { impact: 'medium' }),
		];
		expect(dueEvents(alert, events, now, new Set()).map((e) => e.id)).toEqual(['nfp']);
		expect(dueEvents(alert, events, now, new Set([firedKey(alert.id, 'nfp')]))).toEqual([]);
		expect(
			dueEvents({ ...alert, currencies: [] }, events, now, new Set()).map((e) => e.id),
		).toEqual(['nfp', 'eur']);
	});
});

describe('formatValue', () => {
	it('formats thresholds readably', () => {
		expect(formatValue(100000)).toBe('100,000');
		expect(formatValue(1.085)).toBe('1.085');
		expect(formatValue(0.00002134)).toBe('0.00002134');
	});
});
