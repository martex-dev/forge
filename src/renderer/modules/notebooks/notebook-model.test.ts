import { describe, expect, it } from 'vitest';

import type { Notebook } from '@shared/ipc/channels/notebooks';

import {
	appendOutputs,
	applyCarriageReturns,
	INITIAL,
	newCell,
	pickMime,
	reducer,
	stripAnsi,
} from './notebook-model';

const nb = (): Notebook => ({
	cells: [newCell('code', 'a'), newCell('markdown', '# b')],
	metadata: {},
	nbformat: 4,
	nbformat_minor: 5,
});

describe('notebook model', () => {
	it('handles carriage returns like a terminal (tqdm)', () => {
		expect(applyCarriageReturns('10%\r50%\r100%\ndone\n')).toBe('100%\ndone\n');
		expect(applyCarriageReturns('line\r\n')).toBe('line\n');
	});

	it('strips ANSI colours', () => {
		expect(stripAnsi('\u001b[0;31mZeroDivisionError\u001b[0m')).toBe('ZeroDivisionError');
	});

	it('merges streams, keeps other outputs, applies clear_output', () => {
		const a = appendOutputs(
			[],
			[
				{ output_type: 'stream', name: 'stdout', text: 'a\n' },
				{ output_type: 'stream', name: 'stdout', text: 'b\n' },
				{ output_type: 'stream', name: 'stderr', text: '0%\r' },
			],
		);
		expect(a).toEqual([
			{ output_type: 'stream', name: 'stdout', text: 'a\nb\n' },
			{ output_type: 'stream', name: 'stderr', text: '0%' },
		]);
		const b = appendOutputs(a, [{ output_type: 'stream', name: 'stderr', text: '\r100%\n' }]);
		expect(b[1]).toEqual({ output_type: 'stream', name: 'stderr', text: '100%\n' });
		expect(appendOutputs(b, [{ output_type: 'clear_output', wait: false }])).toEqual([]);
	});

	it('edits, inserts, moves, removes and counts versions', () => {
		let s = reducer(INITIAL, { type: 'load', nb: nb() });
		const [first, second] = s.nb?.cells ?? [];
		if (!first || !second) throw new Error('cells');
		s = reducer(s, { type: 'edit', id: first.id, source: 'x = 1' });
		expect(s.version).toBe(1);
		s = reducer(s, { type: 'move', id: first.id, by: 1 });
		expect(s.nb?.cells.map((c) => c.id)).toEqual([second.id, first.id]);
		s = reducer(s, { type: 'move', id: first.id, by: 1 }); // already last: no change
		expect(s.version).toBe(2);
		s = reducer(s, { type: 'insert', index: 0, cell: newCell('raw') });
		expect(s.nb?.cells[0]?.cell_type).toBe('raw');
		s = reducer(s, { type: 'setType', id: second.id, cellType: 'code' });
		expect(s.nb?.cells[1]?.cell_type).toBe('code');
		for (const c of s.nb?.cells ?? []) s = reducer(s, { type: 'remove', id: c.id });
		expect(s.nb?.cells).toHaveLength(1); // never empty
		s = reducer(s, { type: 'saved', version: s.version });
		expect(s.saved).toBe(s.version);
	});

	it('tracks running cells outside the notebook (no dirty flag)', () => {
		let s = reducer(INITIAL, { type: 'load', nb: nb() });
		s = reducer(s, { type: 'run', id: 'x', state: 'running' });
		expect(s.running).toEqual({ x: 'running' });
		expect(s.version).toBe(0);
		s = reducer(s, { type: 'run', id: 'x', state: null });
		expect(s.running).toEqual({});
	});

	it('picks the richest safe representation', () => {
		expect(pickMime({ 'text/plain': 'x', 'image/png': 'iV' })?.mime).toBe('image/png');
		expect(pickMime({ 'text/html': '<b>x</b>', 'text/plain': 'x' })?.mime).toBe('text/plain');
		expect(pickMime({ 'text/html': '<b>x</b>' })?.mime).toBe('text/html');
		expect(pickMime({})).toBeNull();
	});
});
