import { randomUUID } from 'node:crypto';

import {
	type NbCell,
	type NbOutput,
	type Notebook,
	NotebookSchema,
} from '@shared/ipc/channels/notebooks';

import { ForgeError } from '../../core/errors';

type Json = Record<string, unknown>;

const text = (v: unknown): string =>
	Array.isArray(v) ? v.join('') : typeof v === 'string' ? v : '';

/** nbformat stores multi-line strings as lists of lines, each keeping its newline. */
export function toLines(s: string): string[] {
	return s === '' ? [] : (s.match(/[^\n]*\n|[^\n]+$/g) ?? []);
}

function readOutput(o: Json): NbOutput | null {
	switch (o['output_type']) {
		case 'stream':
			return {
				output_type: 'stream',
				name: String(o['name'] ?? 'stdout'),
				text: text(o['text']),
			};
		case 'execute_result':
		case 'display_data': {
			const data: Record<string, unknown> = {};
			for (const [mime, v] of Object.entries((o['data'] as Json | undefined) ?? {})) {
				data[mime] = mime.endsWith('json') ? v : text(v);
			}
			const metadata = (o['metadata'] as Json | undefined) ?? {};
			return o['output_type'] === 'execute_result'
				? {
						output_type: 'execute_result',
						data,
						metadata,
						execution_count:
							typeof o['execution_count'] === 'number' ? o['execution_count'] : null,
					}
				: { output_type: 'display_data', data, metadata };
		}
		case 'error':
			return {
				output_type: 'error',
				ename: String(o['ename'] ?? ''),
				evalue: String(o['evalue'] ?? ''),
				traceback: Array.isArray(o['traceback']) ? o['traceback'].map(String) : [],
			};
		default:
			return null;
	}
}

/** Parses a .ipynb (nbformat 4.x) into the panel's model. Unknown output kinds are dropped. */
export function parseNotebook(raw: string): Notebook {
	let json: Json;
	try {
		json = JSON.parse(raw) as Json;
	} catch {
		throw new ForgeError('NB_BAD_JSON', 'This file is not valid notebook JSON');
	}
	if (json['nbformat'] !== 4) {
		throw new ForgeError(
			'NB_VERSION',
			'Only nbformat 4 notebooks are supported (Jupyter 4.0+)',
		);
	}
	const cells: NbCell[] = ((json['cells'] as Json[] | undefined) ?? []).map((c) => {
		const type =
			c['cell_type'] === 'markdown' || c['cell_type'] === 'raw' ? c['cell_type'] : 'code';
		return {
			id: typeof c['id'] === 'string' ? c['id'] : randomUUID().slice(0, 8),
			cell_type: type,
			source: text(c['source']),
			metadata: (c['metadata'] as Json | undefined) ?? {},
			outputs:
				type === 'code'
					? ((c['outputs'] as Json[] | undefined) ?? []).flatMap(
							(o) => readOutput(o) ?? [],
						)
					: [],
			execution_count:
				type === 'code' && typeof c['execution_count'] === 'number'
					? c['execution_count']
					: null,
		};
	});
	return NotebookSchema.parse({
		cells,
		metadata: (json['metadata'] as Json | undefined) ?? {},
		nbformat: 4,
		nbformat_minor:
			typeof json['nbformat_minor'] === 'number' ? Math.max(5, json['nbformat_minor']) : 5,
	});
}

function writeOutput(o: NbOutput): Json | null {
	switch (o.output_type) {
		case 'stream':
			return { output_type: 'stream', name: o.name, text: toLines(o.text) };
		case 'execute_result':
		case 'display_data': {
			const data: Json = {};
			for (const [mime, v] of Object.entries(o.data)) {
				data[mime] = typeof v === 'string' && !mime.startsWith('image/') ? toLines(v) : v;
			}
			return o.output_type === 'execute_result'
				? {
						output_type: o.output_type,
						data,
						metadata: o.metadata,
						execution_count: o.execution_count,
					}
				: { output_type: o.output_type, data, metadata: o.metadata };
		}
		case 'error':
			return {
				output_type: 'error',
				ename: o.ename,
				evalue: o.evalue,
				traceback: o.traceback,
			};
		case 'clear_output':
			return null;
	}
}

/** Serializes the way Jupyter does (1-space indent, line lists), so diffs stay small. */
export function serializeNotebook(nb: Notebook): string {
	const cells = nb.cells.map((c) => {
		const base: Json = {
			cell_type: c.cell_type,
			id: c.id,
			metadata: c.metadata,
			source: toLines(c.source),
		};
		if (c.cell_type !== 'code') return base;
		return {
			...base,
			execution_count: c.execution_count,
			outputs: c.outputs.flatMap((o) => writeOutput(o) ?? []),
		};
	});
	const out = { cells, metadata: nb.metadata, nbformat: 4, nbformat_minor: nb.nbformat_minor };
	return `${JSON.stringify(out, null, 1)}\n`;
}

export function emptyNotebook(): Notebook {
	return {
		cells: [
			{
				id: randomUUID().slice(0, 8),
				cell_type: 'code',
				source: '',
				metadata: {},
				outputs: [],
				execution_count: null,
			},
		],
		metadata: {},
		nbformat: 4,
		nbformat_minor: 5,
	};
}
