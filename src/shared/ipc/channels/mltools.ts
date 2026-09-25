import { z } from 'zod';

import { defineChannels } from '../define';
import { CalibrationSchema, CvFoldsSchema } from './lab';

/** Where the job runs: Forge's bundled libraries, or a kernel from one of Marto's envs. */
export const MlEngineSchema = z.union([
	z.object({ kind: z.literal('bundled') }),
	z.object({ kind: z.literal('env'), spec: z.string().min(1).max(200) }),
	z.object({ kind: z.literal('env'), python: z.string().min(3).max(1024) }),
]);
export type MlEngine = z.infer<typeof MlEngineSchema>;

export const CvParamsSchema = z.object({
	splitter: z.enum(['kfold', 'timeseries', 'purged']),
	n_samples: z.number().int().min(10).max(100_000),
	n_splits: z.number().int().min(2).max(20),
	shuffle: z.boolean(),
	seed: z.number().int(),
	gap: z.number().int().min(0).max(10_000),
	/** Rows until each label resolves (purged-cv's label_end_times = i + horizon). */
	horizon: z.number().int().min(0).max(10_000),
	embargo_pct: z.number().min(0).lt(0.5),
});
export type CvParams = z.infer<typeof CvParamsSchema>;

const DataPath = z
	.string()
	.min(3)
	.max(1024)
	.refine((p) => /\.(csv|tsv|txt|parquet|pq)$/i.test(p), 'Pick a CSV or Parquet file');

export const CalibrationParamsSchema = z.object({
	path: DataPath,
	y_true: z.string().min(1).max(200),
	y_prob: z.string().min(1).max(200),
	variants: z.array(z.string().min(1).max(200)).max(4),
	n_bins: z.number().int().min(2).max(50),
});
export type CalibrationParams = z.infer<typeof CalibrationParamsSchema>;

export const mlChannels = defineChannels({
	'ml:cv': {
		input: z.object({ params: CvParamsSchema, engine: MlEngineSchema }),
		output: CvFoldsSchema,
	},
	'ml:calibration': {
		input: z.object({ params: CalibrationParamsSchema, engine: MlEngineSchema }),
		output: CalibrationSchema.extend({ dropped_rows: z.number().int() }),
	},
	'ml:pickFile': { input: z.void(), output: z.string().nullable() },
	'ml:columns': { input: DataPath, output: z.array(z.string()) },
	'ml:kernelspecs': {
		input: z.void(),
		output: z.array(z.object({ name: z.string(), displayName: z.string() })),
	},
	'ml:pickPython': { input: z.void(), output: z.string().nullable() },
});
