import { describe, expect, it } from 'vitest';

import type { JournalEntry } from '@shared/ipc/channels/journal';

import {
	computeStats,
	entryPnl,
	entryR,
	filterEntries,
	newEntry,
	parseNum,
	parseTags,
	plannedRR,
} from './journal-model';

let n = 0;
const trade = (init: Partial<JournalEntry>): JournalEntry =>
	newEntry(`id-${++n}`, 1_000 + n, { symbol: 'BTCUSDT', status: 'closed', ...init });

describe('journal model', () => {
	it('derives P/L from prices for longs and shorts, net of fees', () => {
		expect(entryPnl(trade({ entry: 100, exit: 110, size: 2, fees: 1 }))).toBe(19);
		expect(entryPnl(trade({ side: 'short', entry: 100, exit: 110, size: 2 }))).toBe(-20);
		expect(entryPnl(trade({ pnl: 50, fees: 5, entry: 1, exit: 2, size: 1 }))).toBe(45);
		expect(entryPnl(trade({ status: 'open', entry: 100, exit: 110, size: 1 }))).toBeNull();
		expect(entryPnl(trade({ entry: 100, size: 1 }))).toBeNull();
		expect(entryPnl(trade({ entry: 1.08, exit: 1.085, size: 10_000 }))).toBe(50);
	});

	it('computes R from the stop, and planned reward:risk', () => {
		expect(entryR(trade({ entry: 100, stop: 95, exit: 110 }))).toBe(2);
		expect(entryR(trade({ side: 'short', entry: 100, stop: 105, exit: 110 }))).toBe(-2);
		expect(entryR(trade({ entry: 100, stop: 100, exit: 110 }))).toBeNull();
		expect(plannedRR(trade({ entry: 100, stop: 95, target: 115 }))).toBe(3);
	});

	it('builds stats, equity curve and drawdown in time order', () => {
		const s = computeStats([
			trade({ pnl: -30, closedAt: 3, setup: 'breakout' }),
			trade({ pnl: 100, closedAt: 1, setup: 'breakout' }),
			trade({ pnl: -50, closedAt: 2, setup: 'fade' }),
			trade({ pnl: 40, closedAt: 4, setup: 'fade' }),
			trade({ status: 'idea' }),
			trade({ entry: 1 }), // closed but without a P/L
		]);
		expect(s.closed).toBe(5);
		expect(s.scored).toBe(4);
		expect(s.winRate).toBe(0.5);
		expect(s.net).toBe(60);
		expect(s.profitFactor).toBeCloseTo(140 / 80);
		expect(s.maxDrawdown).toBe(80);
		expect(s.equity.map((p) => p[1])).toEqual([100, 50, 20, 60]);
		expect(s.bySetup).toEqual([
			{ key: 'breakout', trades: 2, winRate: 0.5, net: 70 },
			{ key: 'fade', trades: 2, winRate: 0.5, net: -10 },
		]);
	});

	it('handles an empty journal', () => {
		const s = computeStats([]);
		expect(s.winRate).toBeNull();
		expect(s.profitFactor).toBeNull();
		expect(s.equity).toEqual([]);
	});

	it('filters by status, tag and text', () => {
		const list = [
			trade({ symbol: 'EURUSD', tags: ['london'], notes: 'clean retest' }),
			trade({ symbol: 'XAUUSD', status: 'idea', setup: 'range fade' }),
		];
		const base = { query: '', status: 'all' as const, tag: null };
		expect(filterEntries(list, { ...base, query: 'retest' })).toHaveLength(1);
		expect(filterEntries(list, { ...base, query: 'fade' })[0]?.symbol).toBe('XAUUSD');
		expect(filterEntries(list, { ...base, status: 'idea' })).toHaveLength(1);
		expect(filterEntries(list, { ...base, tag: 'london' })[0]?.symbol).toBe('EURUSD');
	});

	it('parses number and tag fields', () => {
		expect(parseNum(' 1,234.5 ')).toBe(1234.5);
		expect(parseNum('')).toBeNull();
		expect(parseNum('abc')).toBeUndefined();
		expect(parseTags('#london, a+  london fomo')).toEqual(['london', 'a+', 'fomo']);
	});
});
