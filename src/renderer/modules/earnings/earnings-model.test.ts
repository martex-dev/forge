import { describe, expect, it } from 'vitest';

import type { EarningsEvent } from '@shared/ipc/channels/earnings';

import {
	filterEarnings,
	formatCap,
	formatDay,
	groupEarnings,
	todayEt,
	weekRange,
} from './earnings-model';

const ev = (symbol: string, date: string, extra: Partial<EarningsEvent> = {}): EarningsEvent => ({
	id: `${date}:${symbol}`,
	date,
	session: 'afterhours',
	symbol,
	name: `${symbol} Inc.`,
	impact: 'medium',
	marketCap: null,
	epsForecast: null,
	epsActual: null,
	epsPrevious: null,
	source: 'nasdaq',
	...extra,
});

describe('earnings model', () => {
	it('computes Monday–Friday weeks, rolling weekends forward', () => {
		expect(weekRange('2026-09-25', 0)).toEqual({ start: '2026-09-21', end: '2026-09-25' });
		expect(weekRange('2026-09-25', 1)).toEqual({ start: '2026-09-28', end: '2026-10-02' });
		expect(weekRange('2026-09-26', 0)).toEqual({ start: '2026-09-28', end: '2026-10-02' });
		expect(weekRange('2026-09-27', -1)).toEqual({ start: '2026-09-21', end: '2026-09-25' });
		expect(weekRange('2026-12-30', 1)).toEqual({ start: '2027-01-04', end: '2027-01-08' });
	});

	it('uses the US Eastern date', () => {
		// 02:00 UTC on the 26th is still the 25th in New York.
		expect(todayEt(Date.UTC(2026, 8, 26, 2))).toBe('2026-09-25');
	});

	it('filters by impact and text, and groups by day in order', () => {
		const list = [
			ev('NVDA', '2026-09-24', { impact: 'high', name: 'NVIDIA Corporation' }),
			ev('TINY', '2026-09-23', { impact: 'low' }),
			ev('AAPL', '2026-09-23'),
		];
		const shown = filterEarnings(list, { impacts: ['high', 'medium'], query: '' });
		expect(shown.map((e) => e.symbol)).toEqual(['NVDA', 'AAPL']);
		expect(
			filterEarnings(list, { impacts: ['high', 'medium', 'low'], query: 'nvidia' }),
		).toHaveLength(1);
		const days = groupEarnings(shown);
		expect(days.map((d) => [d.date, d.events.length])).toEqual([
			['2026-09-23', 1],
			['2026-09-24', 1],
		]);
		expect(formatDay('2026-09-23')).toBe('Wed 23 Sept');
	});

	it('formats market caps compactly', () => {
		expect(formatCap(3.51e12)).toBe('$3.51T');
		expect(formatCap(168.4e9)).toBe('$168B');
		expect(formatCap(8.8e9)).toBe('$8.8B');
		expect(formatCap(null)).toBe('');
	});
});
