import { describe, expect, it } from 'vitest';

import {
	chartGroups,
	flattenConfig,
	formatDuration,
	formatMetric,
	mergePoints,
	type SeriesState,
	toSeries,
} from './runs-model';

describe('mergePoints / toSeries', () => {
	it('accumulates, overwrites re-logged steps and sorts by step', () => {
		let state: SeriesState = new Map();
		state = mergePoints(state, [
			{ key: 'loss', step: 2, value: 1.5 },
			{ key: 'loss', step: 1, value: 2 },
			{ key: 'acc', step: 1, value: 0.1 },
		]);
		const before = state;
		state = mergePoints(state, [
			{ key: 'loss', step: 2, value: 1.4 },
			{ key: 'loss', step: 3, value: null },
		]);
		expect(toSeries(state)).toEqual({
			loss: [
				[1, 2],
				[2, 1.4],
				[3, null],
			],
			acc: [[1, 0.1]],
		});
		// Immutable: the previous state (held by React) is untouched.
		expect(toSeries(before)['loss']).toEqual([
			[1, 2],
			[2, 1.5],
		]);
		expect(mergePoints(state, [])).toBe(state);
	});
});

describe('chartGroups', () => {
	it('groups train/val variants of the same metric', () => {
		expect(chartGroups(['train/loss', 'val/loss', 'lr', 'val/acc', 'odd/'])).toEqual([
			{ title: 'loss', keys: ['train/loss', 'val/loss'] },
			{ title: 'lr', keys: ['lr'] },
			{ title: 'acc', keys: ['val/acc'] },
			{ title: 'odd/', keys: ['odd/'] },
		]);
	});
});

describe('flattenConfig', () => {
	it('flattens nested objects with dotted paths', () => {
		expect(
			flattenConfig({ lr: 0.001, model: { layers: 2, act: 'relu' }, sizes: [1, 2], x: null }),
		).toEqual([
			['lr', '0.001'],
			['model.layers', '2'],
			['model.act', 'relu'],
			['sizes', '[1,2]'],
			['x', 'null'],
		]);
	});
});

describe('formatting', () => {
	it('formats durations', () => {
		expect(formatDuration(45_000)).toBe('45s');
		expect(formatDuration(723_000)).toBe('12m 03s');
		expect(formatDuration(7_500_000)).toBe('2h 05m');
		expect(formatDuration(3 * 86_400_000 + 4 * 3_600_000)).toBe('3d 4h');
	});

	it('formats metric values', () => {
		expect(formatMetric(null)).toBe('NaN');
		expect(formatMetric(0.000123)).toBe('1.230e-4');
		expect(formatMetric(2.5)).toBe('2.5000');
		expect(formatMetric(12_345.6)).toBe('12,346');
		expect(formatMetric(0)).toBe('0.0000');
	});
});
