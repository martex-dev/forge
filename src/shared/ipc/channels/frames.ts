import { z } from 'zod';

import { defineChannels } from '../define';

export const FRAME_EXTENSIONS = [
	'csv',
	'tsv',
	'txt',
	'parquet',
	'pq',
	'json',
	'jsonl',
	'ndjson',
	'feather',
	'arrow',
	'ipc',
] as const;

/** Absolute path to a data file the viewer can open (Windows or POSIX). */
export const FramePathSchema = z
	.string()
	.min(3)
	.max(1024)
	.refine((p) => /^([a-zA-Z]:[\\/]|\\\\|\/)/.test(p), 'Must be an absolute path')
	.refine(
		(p) =>
			(FRAME_EXTENSIONS as readonly string[]).includes(
				p.split('.').pop()?.toLowerCase() ?? '',
			),
		'Not a CSV, TSV, Parquet, JSON or Feather file',
	);

export const FrameColumnSchema = z.object({ name: z.string(), type: z.string() });
export type FrameColumn = z.infer<typeof FrameColumnSchema>;

export const FrameInfoSchema = z.object({
	path: z.string(),
	format: z.enum(['csv', 'parquet', 'json', 'arrow']),
	columns: z.array(FrameColumnSchema),
	rowCount: z.number().int(),
});
export type FrameInfo = z.infer<typeof FrameInfoSchema>;

/** JSON-safe cell: numbers, strings (dates as ISO, NaN as 'nan'), booleans, null, lists, structs. */
export type Cell = unknown;

export const FramePageSchema = z.object({
	columns: z.array(FrameColumnSchema),
	rows: z.array(z.array(z.unknown())),
	total: z.number().int(),
	offset: z.number().int(),
});
export type FramePage = z.infer<typeof FramePageSchema>;

export const FrameQuerySchema = z.object({
	sort: z.array(z.object({ column: z.string().max(512), desc: z.boolean() })).max(8),
	/** SQL expression for WHERE, e.g. `loss < 0.1 AND split = 'val'`. */
	where: z.string().max(4000).optional(),
	/** A full SELECT over `t` (the file). */
	sql: z.string().max(20000).optional(),
});
export type FrameQuery = z.infer<typeof FrameQuerySchema>;

const Stat = z.union([z.string(), z.number()]).nullable();

export const FrameSummaryRowSchema = z.object({
	column: z.string(),
	type: z.string(),
	min: Stat,
	max: Stat,
	unique: Stat,
	mean: Stat,
	std: Stat,
	q25: Stat,
	q50: Stat,
	q75: Stat,
	count: Stat,
	nullPercent: Stat,
});
export type FrameSummaryRow = z.infer<typeof FrameSummaryRowSchema>;

export const FrameHistogramSchema = z.discriminatedUnion('kind', [
	z.object({
		kind: z.literal('numeric'),
		edges: z.array(z.number()),
		counts: z.array(z.number()),
	}),
	z.object({
		kind: z.literal('categorical'),
		labels: z.array(z.unknown()),
		counts: z.array(z.number()),
	}),
]);
export type FrameHistogram = z.infer<typeof FrameHistogramSchema>;

export const framesChannels = defineChannels({
	/** Native open dialog; null when cancelled. */
	'frames:pick': { input: z.void(), output: z.string().nullable() },
	'frames:recent': { input: z.void(), output: z.array(z.string()) },
	'frames:open': { input: FramePathSchema, output: FrameInfoSchema },
	'frames:rows': {
		input: FrameQuerySchema.extend({
			path: FramePathSchema,
			offset: z.number().int().min(0),
			limit: z.number().int().min(1).max(1000),
		}),
		output: FramePageSchema,
	},
	'frames:summary': { input: FramePathSchema, output: z.array(FrameSummaryRowSchema) },
	'frames:histogram': {
		input: z.object({
			path: FramePathSchema,
			column: z.string().max(512),
			bins: z.number().int().min(2).max(200),
		}),
		output: FrameHistogramSchema,
	},
	'frames:close': { input: FramePathSchema, output: z.void() },
});
