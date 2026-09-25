import { describe, expect, it } from 'vitest';

import { presentCategories, reliabilityPoints } from './artifacts-model';

describe('artifact views', () => {
	it('lists only the fold categories that occur', () => {
		const kfold = {
			n: 4,
			splitter: 'KFold',
			detailed: false,
			folds: [
				[
					[1, 0, 2],
					[0, 2, 4],
				],
			],
		};
		expect(presentCategories(kfold as never)).toEqual(['train', 'test']);
		const purged = {
			...kfold,
			detailed: true,
			folds: [
				[
					[1, 0, 1],
					[2, 1, 2],
					[3, 2, 3],
					[4, 3, 4],
				],
			],
		};
		expect(presentCategories(purged as never)).toEqual([
			'test',
			'purged',
			'embargoed',
			'unused',
		]);
	});

	it('leaves empty bins out of the reliability curve', () => {
		const bin = (count: number, p: number | null, o: number | null) => ({
			lower: 0,
			upper: 0.1,
			count,
			mean_predicted: p,
			observed_frequency: o,
			gap: null,
		});
		expect(
			reliabilityPoints([bin(10, 0.05, 0.02), bin(0, null, null), bin(3, 0.9, 1)]),
		).toEqual([
			[0.05, 0.02],
			[0.9, 1],
		]);
	});
});
