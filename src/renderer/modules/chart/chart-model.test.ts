import { describe, expect, it } from 'vitest';

import type { Candle } from '@shared/ipc/channels/chart';

import {
	DEFAULT_INTERVAL,
	DEFAULT_SOURCE,
	formatTick,
	pricePrecision,
	readParams,
	sourceKey,
	summarize,
	tailUpdates,
} from './chart-model';

const bar = (time: number, close = 1, open = 1): Candle => ({
	time,
	open,
	high: Math.max(open, close) + 1,
	low: Math.min(open, close) - 0.5,
	close,
	volume: 10,
});

describe('readParams', () => {
	it('falls back per field on missing or invalid params', () => {
		expect(readParams({})).toEqual({
			source: DEFAULT_SOURCE,
			interval: DEFAULT_INTERVAL,
			label: null,
		});
		const pool = { kind: 'pool', chainId: 'solana', pairAddress: 'a'.repeat(44) };
		expect(readParams({ source: pool, interval: '4h', label: 'BONK/SOL' })).toEqual({
			source: pool,
			interval: '4h',
			label: 'BONK/SOL',
		});
		expect(readParams({ source: { kind: 'binance', symbol: 'x' }, interval: '2h' })).toEqual(
			readParams({}),
		);
	});

	it('normalizes Binance symbols to upper case', () => {
		expect(readParams({ source: { kind: 'binance', symbol: ' ethusdt ' } }).source).toEqual({
			kind: 'binance',
			symbol: 'ETHUSDT',
		});
	});
});

describe('sourceKey', () => {
	it('is case-insensitive for pool addresses', () => {
		const a = { kind: 'pool', chainId: 'base', pairAddress: '0xABCDEF0123456789abcd' } as const;
		expect(sourceKey(a)).toBe(sourceKey({ ...a, pairAddress: a.pairAddress.toLowerCase() }));
	});
});

describe('tailUpdates', () => {
	const prev = [bar(60), bar(120), bar(180)];

	it('returns the moving last bar plus any new ones', () => {
		expect(tailUpdates(prev, [bar(60), bar(120), bar(180, 2)])).toEqual([bar(180, 2)]);
		expect(tailUpdates(prev, [bar(120), bar(180, 2), bar(240)])).toEqual([
			bar(180, 2),
			bar(240),
		]);
	});

	it('asks for a full redraw when the series jumped or there is nothing yet', () => {
		expect(tailUpdates([], prev)).toBeNull();
		expect(tailUpdates(prev, [bar(600), bar(660)])).toBeNull();
		const many = Array.from({ length: 10 }, (_, i) => bar(180 + i * 60));
		expect(tailUpdates(prev, many)).toBeNull();
	});
});

describe('pricePrecision', () => {
	it('keeps about four significant digits', () => {
		expect(pricePrecision(84_417.05)).toBe(2);
		expect(pricePrecision(1.5)).toBe(3);
		expect(pricePrecision(0.55)).toBe(4);
		expect(pricePrecision(0.0000213)).toBe(8);
		expect(pricePrecision(1e-15)).toBe(12);
		expect(pricePrecision(0)).toBe(2);
	});
});

describe('summarize', () => {
	it('computes change from the first open and the range extremes', () => {
		expect(summarize([])).toBeNull();
		const s = summarize([bar(60, 1, 2), bar(120, 3, 1)]);
		expect(s).toEqual({ last: 3, change: 50, high: 4, low: 0.5 });
	});
});

describe('formatTick', () => {
	it('formats local time labels', () => {
		const t = new Date(2026, 8, 25, 14, 5).getTime() / 1000;
		expect(formatTick(t, 'time')).toBe('14:05');
		expect(formatTick(t, 'day')).toBe('25 Sep');
		expect(formatTick(t, 'month')).toBe('Sep');
		expect(formatTick(t, 'year')).toBe('2026');
	});
});
