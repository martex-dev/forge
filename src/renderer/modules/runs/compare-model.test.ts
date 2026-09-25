import { describe, expect, it } from 'vitest';

import type { Run } from '@shared/ipc/channels/lab';

import {
	bestIndex,
	configDiff,
	defaultComparison,
	metricDirection,
	sharedKeys,
	smooth,
} from './compare-model';

describe('compare model', () => {
	it('guesses which way is better from the metric name', () => {
		expect(metricDirection('val/loss')).toBe('min');
		expect(metricDirection('train_rmse')).toBe('min');
		expect(metricDirection('val/acc')).toBe('max');
		expect(metricDirection('f1_macro')).toBe('max');
		expect(metricDirection('lr')).toBeNull();
	});

	it('picks the best value, ignoring missing ones', () => {
		expect(bestIndex([0.3, 0.1, null, 0.2], 'min')).toBe(1);
		expect(bestIndex([0.8, null, 0.9], 'max')).toBe(2);
		expect(bestIndex([0.1, 0.2], null)).toBeNull();
		expect(bestIndex([0.1, null], 'min')).toBeNull();
		expect(bestIndex([0.99, 0.99, 0.5], 'max')).toBeNull();
		expect(bestIndex([0.5, 0.5, 0.1], 'min')).toBe(2);
	});

	it('diffs flattened configs, marking missing keys', () => {
		const rows = configDiff([
			{ lr: 0.001, model: { layers: 2 }, seed: 1 },
			{ lr: 0.01, model: { layers: 2 } },
		]);
		expect(rows).toEqual([
			{ key: 'lr', values: ['0.001', '0.01'], differs: true },
			{ key: 'model.layers', values: ['2', '2'], differs: false },
			{ key: 'seed', values: ['1', undefined], differs: true },
		]);
	});

	it('smooths with a debiased EMA and passes NaN through', () => {
		const raw: Array<[number, number | null]> = [
			[0, 1],
			[1, null],
			[2, 3],
		];
		expect(smooth(raw, 0)).toEqual(raw);
		const out = smooth(raw, 0.5);
		expect(out[0]).toEqual([0, 1]); // debiased: the first point is the point itself
		expect(out[1]).toEqual([1, null]);
		expect(out[2]?.[1]).toBeCloseTo((0.5 * 0.5 + 0.5 * 3) / (1 - 0.25));
	});

	it('orders metric keys by how many runs share them', () => {
		expect(sharedKeys([['loss', 'acc'], ['loss'], ['loss', 'lr']])).toEqual([
			'loss',
			'acc',
			'lr',
		]);
	});

	it('compares a run with the closest earlier run of the same project', () => {
		const run = (id: string, startedAt: number, project: string | null): Run => ({
			id,
			name: id,
			project,
			status: 'finished',
			error: null,
			startedAt,
			endedAt: startedAt + 1,
			updatedAt: startedAt + 1,
			pid: null,
			host: null,
			script: null,
			lastStep: 1,
			metricKeys: [],
		});
		// Newest first, as the list comes.
		const runs = [run('d', 4, 'b'), run('c', 3, 'a'), run('b', 2, 'b'), run('a', 1, 'a')];
		expect(defaultComparison(runs, runs[0] as Run)).toEqual(['d', 'b']);
		expect(defaultComparison(runs, runs[1] as Run)).toEqual(['c', 'a']);
		expect(defaultComparison(runs, runs[3] as Run)).toEqual(['a', 'd']);
		expect(defaultComparison([run('x', 1, null)], run('x', 1, null))).toEqual(['x']);
	});
});
