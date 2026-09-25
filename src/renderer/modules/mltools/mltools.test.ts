import { describe, expect, it } from 'vitest';

import { guessColumns } from './CalibrationFromFile';
import { engineKey } from './EnginePicker';

describe('ml tools', () => {
	it('guesses label and probability columns', () => {
		expect(guessColumns(['id', 'label', 'prob', 'prob_iso'])).toEqual({
			y_true: 'label',
			y_prob: 'prob',
		});
		expect(guessColumns(['y_true', 'y_prob'])).toEqual({ y_true: 'y_true', y_prob: 'y_prob' });
		expect(guessColumns(['a', 'b'])).toEqual({ y_true: '', y_prob: '' });
	});

	it('keys engines stably', () => {
		expect(engineKey({ kind: 'bundled' })).toBe('__bundled__');
		expect(engineKey({ kind: 'env', spec: 'torch' })).toBe('spec:torch');
		expect(engineKey({ kind: 'env', python: 'C:/x/python.exe' })).toBe(
			'python:C:/x/python.exe',
		);
	});
});
