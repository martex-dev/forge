import type { NbCell, NbOutput, Notebook } from '@shared/ipc/channels/notebooks';

export type RunState = 'queued' | 'running';

export interface NbState {
	nb: Notebook | null;
	/** Bumped on every change; autosave writes when it differs from `saved`. */
	version: number;
	saved: number;
	running: Record<string, RunState>;
}

export const INITIAL: NbState = { nb: null, version: 0, saved: 0, running: {} };

export type NbAction =
	| { type: 'load'; nb: Notebook }
	| { type: 'edit'; id: string; source: string }
	| { type: 'setType'; id: string; cellType: NbCell['cell_type'] }
	| { type: 'insert'; index: number; cell: NbCell }
	| { type: 'remove'; id: string }
	| { type: 'move'; id: string; by: -1 | 1 }
	| { type: 'clearOutputs'; id?: string }
	| { type: 'outputs'; id: string; outputs: NbOutput[] }
	| { type: 'count'; id: string; count: number | null }
	| { type: 'run'; id: string; state: RunState | null }
	| { type: 'metadata'; patch: Record<string, unknown> }
	| { type: 'saved'; version: number };

// ANSI colour codes from tracebacks and tqdm; shown as plain text.
// eslint-disable-next-line no-control-regex -- matching escape sequences is the point
const ANSI = /\u001b\[[0-9;?]*[A-Za-z]|\u001b\][^\u0007]*\u0007/g;

export function stripAnsi(text: string): string {
	return text.replace(ANSI, '');
}

/** A terminal's \r: the text after it overwrites the line (tqdm progress bars). */
export function applyCarriageReturns(text: string): string {
	return text
		.split('\n')
		.map((line) => {
			const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line;
			const i = trimmed.lastIndexOf('\r');
			return i === -1 ? trimmed : trimmed.slice(i + 1);
		})
		.join('\n');
}

/**
 * Appends kernel outputs the way Jupyter displays them: consecutive stream text of the same
 * name merges (with \r handling), and clear_output empties the area.
 */
export function appendOutputs(
	existing: readonly NbOutput[],
	incoming: readonly NbOutput[],
): NbOutput[] {
	let out = [...existing];
	for (const o of incoming) {
		if (o.output_type === 'clear_output') {
			out = [];
			continue;
		}
		const last = out.at(-1);
		if (o.output_type === 'stream' && last?.output_type === 'stream' && last.name === o.name) {
			out[out.length - 1] = { ...last, text: applyCarriageReturns(last.text + o.text) };
			continue;
		}
		out.push(o.output_type === 'stream' ? { ...o, text: applyCarriageReturns(o.text) } : o);
	}
	return out;
}

let seq = 0;
export function newCell(type: NbCell['cell_type'] = 'code', source = ''): NbCell {
	seq += 1;
	return {
		id: `${Date.now().toString(36)}${seq.toString(36)}`.slice(-8),
		cell_type: type,
		source,
		metadata: {},
		outputs: [],
		execution_count: null,
	};
}

function mapCell(nb: Notebook, id: string, fn: (c: NbCell) => NbCell): Notebook {
	return { ...nb, cells: nb.cells.map((c) => (c.id === id ? fn(c) : c)) };
}

export function reducer(state: NbState, action: NbAction): NbState {
	if (action.type === 'load') return { nb: action.nb, version: 0, saved: 0, running: {} };
	if (action.type === 'saved') return { ...state, saved: Math.max(state.saved, action.version) };
	if (action.type === 'run') {
		const rest = Object.fromEntries(
			Object.entries(state.running).filter(([id]) => id !== action.id),
		);
		return { ...state, running: action.state ? { ...rest, [action.id]: action.state } : rest };
	}
	const nb = state.nb;
	if (!nb) return state;
	const next = ((): Notebook => {
		switch (action.type) {
			case 'edit':
				return mapCell(nb, action.id, (c) => ({ ...c, source: action.source }));
			case 'setType':
				return mapCell(nb, action.id, (c) => ({
					...c,
					cell_type: action.cellType,
					outputs: action.cellType === 'code' ? c.outputs : [],
					execution_count: action.cellType === 'code' ? c.execution_count : null,
				}));
			case 'insert': {
				const cells = [...nb.cells];
				cells.splice(Math.max(0, Math.min(action.index, cells.length)), 0, action.cell);
				return { ...nb, cells };
			}
			case 'remove': {
				const cells = nb.cells.filter((c) => c.id !== action.id);
				// A notebook always has a cell to type into.
				return { ...nb, cells: cells.length ? cells : [newCell()] };
			}
			case 'move': {
				const i = nb.cells.findIndex((c) => c.id === action.id);
				const j = i + action.by;
				if (i < 0 || j < 0 || j >= nb.cells.length) return nb;
				const cells = [...nb.cells];
				[cells[i], cells[j]] = [cells[j] as NbCell, cells[i] as NbCell];
				return { ...nb, cells };
			}
			case 'clearOutputs':
				return {
					...nb,
					cells: nb.cells.map((c) =>
						action.id === undefined || c.id === action.id
							? { ...c, outputs: [], execution_count: null }
							: c,
					),
				};
			case 'outputs':
				return mapCell(nb, action.id, (c) => ({
					...c,
					outputs: appendOutputs(c.outputs, action.outputs),
				}));
			case 'count':
				return mapCell(nb, action.id, (c) => ({ ...c, execution_count: action.count }));
			case 'metadata':
				return { ...nb, metadata: { ...nb.metadata, ...action.patch } };
		}
	})();
	return next === nb ? state : { ...state, nb: next, version: state.version + 1 };
}

/** Best output representation Forge can show safely (HTML falls back to its text/plain). */
export function pickMime(data: Record<string, unknown>): { mime: string; value: string } | null {
	for (const mime of [
		'image/png',
		'image/jpeg',
		'image/svg+xml',
		'text/markdown',
		'text/plain',
	]) {
		const v = data[mime];
		if (typeof v === 'string') return { mime, value: v };
	}
	if (typeof data['text/html'] === 'string')
		return { mime: 'text/html', value: data['text/html'] };
	if (data['application/json'] !== undefined) {
		return {
			mime: 'application/json',
			value: JSON.stringify(data['application/json'], null, 2),
		};
	}
	return null;
}
