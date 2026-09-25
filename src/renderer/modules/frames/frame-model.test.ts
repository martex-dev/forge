import { describe, expect, it } from 'vitest';

import {
	basename,
	blocksFor,
	columnWidth,
	formatCell,
	instanceIdFor,
	nextSort,
	ROW_HEIGHT,
	visibleRange,
} from './frame-model';

describe('frame model', () => {
	it('computes the rendered row range with overscan, clamped to the data', () => {
		expect(visibleRange(0, 10 * ROW_HEIGHT, 1000)).toEqual({ start: 0, end: 20 });
		expect(visibleRange(100 * ROW_HEIGHT, 10 * ROW_HEIGHT, 1000)).toEqual({
			start: 90,
			end: 120,
		});
		expect(visibleRange(995 * ROW_HEIGHT, 10 * ROW_HEIGHT, 1000).end).toBe(1000);
		expect(visibleRange(0, 500, 0)).toEqual({ start: 0, end: 0 });
	});

	it('maps a range to the request blocks it needs', () => {
		expect(blocksFor({ start: 0, end: 20 })).toEqual([0]);
		expect(blocksFor({ start: 190, end: 210 })).toEqual([0, 1]);
		expect(blocksFor({ start: 400, end: 400 })).toEqual([]);
	});

	it('sizes columns by type and name', () => {
		expect(columnWidth({ name: 'loss', type: 'DOUBLE' })).toBe(98);
		expect(columnWidth({ name: 'note', type: 'VARCHAR' })).toBe(180);
		expect(columnWidth({ name: 'x'.repeat(80), type: 'DOUBLE' })).toBe(320);
	});

	it('formats cells', () => {
		expect(formatCell(0.1 + 0.2)).toBe('0.3');
		expect(formatCell(12)).toBe('12');
		expect(formatCell(1.5e-7)).toBe('1.5000e-7');
		expect(formatCell(null)).toBe('');
		expect(formatCell([1, 2])).toBe('[1,2]');
		expect(formatCell(false)).toBe('false');
	});

	it('cycles sort asc → desc → none, and Shift adds keys', () => {
		const a = nextSort([], 'loss', false);
		expect(a).toEqual([{ column: 'loss', desc: false }]);
		const b = nextSort(a, 'loss', false);
		expect(b).toEqual([{ column: 'loss', desc: true }]);
		expect(nextSort(b, 'loss', false)).toEqual([]);
		expect(nextSort(a, 'epoch', true)).toEqual([
			{ column: 'loss', desc: false },
			{ column: 'epoch', desc: false },
		]);
		expect(nextSort(a, 'epoch', false)).toEqual([{ column: 'epoch', desc: false }]);
	});

	it('names files and panels stably', () => {
		expect(basename('C:\\data\\runs.parquet')).toBe('runs.parquet');
		expect(instanceIdFor('C:\\Data\\a.csv')).toBe(instanceIdFor('c:\\data\\A.csv'));
		expect(instanceIdFor('C:\\a.csv')).not.toBe(instanceIdFor('C:\\b.csv'));
	});
});
