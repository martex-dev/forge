import { z } from 'zod';

import { defineChannels } from '../define';

export const NotebookPathSchema = z
	.string()
	.min(3)
	.max(1024)
	.refine((p) => /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(p), 'Must be an absolute path')
	.refine((p) => p.toLowerCase().endsWith('.ipynb'), 'Not a .ipynb notebook');

/** Mime bundle: nbformat stores text as a string or a list of lines. */
const MimeBundle = z.record(z.string(), z.union([z.string(), z.array(z.string()), z.unknown()]));

export const NbOutputSchema = z.discriminatedUnion('output_type', [
	z.object({ output_type: z.literal('stream'), name: z.string(), text: z.string() }),
	z.object({
		output_type: z.literal('execute_result'),
		data: MimeBundle,
		metadata: z.record(z.string(), z.unknown()),
		execution_count: z.number().int().nullable(),
	}),
	z.object({
		output_type: z.literal('display_data'),
		data: MimeBundle,
		metadata: z.record(z.string(), z.unknown()),
	}),
	z.object({
		output_type: z.literal('error'),
		ename: z.string(),
		evalue: z.string(),
		traceback: z.array(z.string()),
	}),
	/** Kernel instruction, applied by the panel and never saved. */
	z.object({ output_type: z.literal('clear_output'), wait: z.boolean() }),
]);
export type NbOutput = z.infer<typeof NbOutputSchema>;

export const NbCellSchema = z.object({
	id: z.string(),
	cell_type: z.enum(['code', 'markdown', 'raw']),
	/** Always a single string here; main converts to/from nbformat's line lists. */
	source: z.string(),
	metadata: z.record(z.string(), z.unknown()),
	outputs: z.array(NbOutputSchema),
	execution_count: z.number().int().nullable(),
});
export type NbCell = z.infer<typeof NbCellSchema>;

export const NotebookSchema = z.object({
	cells: z.array(NbCellSchema),
	metadata: z.record(z.string(), z.unknown()),
	nbformat: z.literal(4),
	nbformat_minor: z.number().int(),
});
export type Notebook = z.infer<typeof NotebookSchema>;

export const KernelChoiceSchema = z.union([
	z.object({ spec: z.string().min(1).max(200) }),
	z.object({ python: z.string().min(3).max(1024) }),
]);
export type KernelChoice = z.infer<typeof KernelChoiceSchema>;

const SessionId = z.string().regex(/^[0-9a-f]{32}$/);

export const ExecStateSchema = z.object({
	status: z.enum(['queued', 'running', 'done', 'error', 'aborted']),
	executionCount: z.number().int().nullable(),
	outputs: z.array(NbOutputSchema),
	/** Pass back as `after`. */
	next: z.number().int(),
	kernelState: z.enum(['starting', 'idle', 'busy', 'dead']),
});
export type ExecState = z.infer<typeof ExecStateSchema>;

export const notebookChannels = defineChannels({
	'nb:pick': { input: z.void(), output: z.string().nullable() },
	/** Save dialog; writes an empty notebook there. */
	'nb:create': { input: z.void(), output: z.string().nullable() },
	'nb:recent': { input: z.void(), output: z.array(z.string()) },
	'nb:read': { input: NotebookPathSchema, output: NotebookSchema },
	'nb:write': {
		input: z.object({ path: NotebookPathSchema, notebook: NotebookSchema }),
		output: z.void(),
	},
	'nb:kernelspecs': {
		input: z.void(),
		output: z.array(
			z.object({ name: z.string(), displayName: z.string(), language: z.string() }),
		),
	},
	/** File dialog for a python.exe (any environment with ipykernel). */
	'nb:pickPython': { input: z.void(), output: z.string().nullable() },
	'nb:start': {
		input: z.object({ path: NotebookPathSchema, kernel: KernelChoiceSchema }),
		output: z.object({ session: SessionId, label: z.string() }),
	},
	'nb:execute': {
		input: z.object({ session: SessionId, code: z.string().max(1_000_000) }),
		output: z.string(),
	},
	'nb:poll': {
		input: z.object({
			session: SessionId,
			exec: z.string().min(1).max(100),
			after: z.number().int().min(0),
		}),
		output: ExecStateSchema,
	},
	'nb:interrupt': { input: SessionId, output: z.void() },
	'nb:restart': { input: SessionId, output: z.void() },
	'nb:shutdown': { input: SessionId, output: z.void() },
});
