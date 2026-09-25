import { describe, expect, it } from 'vitest';

import { emptyNotebook, parseNotebook, serializeNotebook, toLines } from './notebook-io';

const JUPYTER = JSON.stringify({
	cells: [
		{ cell_type: 'markdown', id: 'md1', metadata: {}, source: ['# Title\n', 'text'] },
		{
			cell_type: 'code',
			id: 'c1',
			metadata: { tags: ['x'] },
			execution_count: 3,
			source: ['import numpy as np\n', 'np.arange(3)'],
			outputs: [
				{ output_type: 'stream', name: 'stdout', text: ['a\n', 'b\n'] },
				{
					output_type: 'execute_result',
					execution_count: 3,
					metadata: {},
					data: { 'text/plain': ['array([0, 1, 2])'], 'image/png': 'iVBOR...' },
				},
				{ output_type: 'error', ename: 'E', evalue: 'v', traceback: ['tb'] },
				{ output_type: 'widget-thing' },
			],
		},
		{ cell_type: 'code', metadata: {}, source: 'x', outputs: [], execution_count: null },
	],
	metadata: { kernelspec: { name: 'python3' } },
	nbformat: 4,
	nbformat_minor: 4,
});

describe('notebook io', () => {
	it('splits text into nbformat line lists', () => {
		expect(toLines('a\nb\n')).toEqual(['a\n', 'b\n']);
		expect(toLines('a\nb')).toEqual(['a\n', 'b']);
		expect(toLines('')).toEqual([]);
	});

	it('parses Jupyter notebooks into single-string sources and known outputs', () => {
		const nb = parseNotebook(JUPYTER);
		expect(nb.cells.map((c) => c.cell_type)).toEqual(['markdown', 'code', 'code']);
		expect(nb.cells[0]?.source).toBe('# Title\ntext');
		expect(nb.cells[1]?.outputs.map((o) => o.output_type)).toEqual([
			'stream',
			'execute_result',
			'error',
		]);
		// Missing ids (nbformat < 4.5) are generated.
		expect(nb.cells[2]?.id).toMatch(/^[0-9a-f-]{8}$/);
		expect(nb.nbformat_minor).toBe(5);
	});

	it('round-trips through serialize with Jupyter formatting', () => {
		const nb = parseNotebook(JUPYTER);
		const text = serializeNotebook(nb);
		expect(text.endsWith('}\n')).toBe(true);
		expect(text).toContain('\n "cells": [');
		const again = parseNotebook(text);
		expect(again).toEqual(nb);
		const json = JSON.parse(text) as {
			cells: Array<{ source: string[]; outputs?: unknown[] }>;
		};
		expect(json.cells[1]?.source).toEqual(['import numpy as np\n', 'np.arange(3)']);
		// Images stay a single base64 string.
		expect(text).toContain('"image/png": "iVBOR..."');
	});

	it('never saves clear_output markers', () => {
		const nb = emptyNotebook();
		const cell = nb.cells[0];
		if (!cell) throw new Error('no cell');
		cell.outputs = [{ output_type: 'clear_output', wait: false }];
		expect(serializeNotebook(nb)).not.toContain('clear_output');
	});

	it('rejects non-notebooks', () => {
		expect(() => parseNotebook('nope')).toThrow(/not valid notebook JSON/);
		expect(() => parseNotebook('{"nbformat": 3}')).toThrow(/nbformat 4/);
	});
});
