import { z } from 'zod';

import { defineChannels } from '../define';

export const RunIdSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
export const RunStatusSchema = z.enum(['running', 'finished', 'failed', 'interrupted']);
export type RunStatus = z.infer<typeof RunStatusSchema>;

export const RunSchema = z.object({
	id: RunIdSchema,
	name: z.string(),
	project: z.string().nullable(),
	status: RunStatusSchema,
	error: z.string().nullable(),
	/** Epoch ms. */
	startedAt: z.number(),
	endedAt: z.number().nullable(),
	updatedAt: z.number(),
	pid: z.number().int().nullable(),
	host: z.string().nullable(),
	script: z.string().nullable(),
	lastStep: z.number().int().nullable(),
	metricKeys: z.array(z.string()),
});
export type Run = z.infer<typeof RunSchema>;

export const ArtifactKindSchema = z.enum(['cv_folds', 'calibration']);
export type ArtifactKind = z.infer<typeof ArtifactKindSchema>;

export const RunDetailSchema = RunSchema.extend({
	config: z.record(z.string(), z.unknown()),
	/** Logged with probe.log_cv / probe.log_calibration. */
	artifacts: z.array(
		z.object({ kind: ArtifactKindSchema, name: z.string(), createdAt: z.number() }),
	),
});

export const CV_CATEGORIES = ['train', 'test', 'purged', 'embargoed', 'unused'] as const;

export const CvFoldsSchema = z.object({
	n: z.number().int().min(0),
	splitter: z.string(),
	/** The splitter reported purge/embargo (purged-cv's split_detail). */
	detailed: z.boolean(),
	/** Per fold: [category index, start, end) runs covering every row. */
	folds: z.array(
		z.array(z.tuple([z.number().int().min(0).max(4), z.number().int(), z.number().int()])),
	),
});
export type CvFolds = z.infer<typeof CvFoldsSchema>;

const Maybe = z.number().nullable();
export const CalibrationReportSchema = z.object({
	n_samples: z.number().int(),
	brier: z.number(),
	ece: z.number(),
	mce: z.number(),
	flag: z.string(),
	bins: z.array(
		z.object({
			lower: z.number(),
			upper: z.number(),
			count: z.number().int(),
			mean_predicted: Maybe,
			observed_frequency: Maybe,
			gap: Maybe,
		}),
	),
});
export type CalibrationReport = z.infer<typeof CalibrationReportSchema>;

export const CalibrationSchema = z.object({
	n_bins: z.number().int(),
	/** 'model' first, then any variants (e.g. isotonic) for the same labels. */
	reports: z.record(z.string(), CalibrationReportSchema),
	/** Rows skipped for a missing label or probability (file-based reports). */
	dropped_rows: z.number().int().optional(),
});
export type Calibration = z.infer<typeof CalibrationSchema>;

export const ArtifactSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('cv_folds'), data: CvFoldsSchema }),
	z.object({ kind: z.literal('calibration'), data: CalibrationSchema }),
]);
export type Artifact = z.infer<typeof ArtifactSchema>;
export type RunDetail = z.infer<typeof RunDetailSchema>;

export const MetricPointSchema = z.object({
	key: z.string(),
	step: z.number().int(),
	/** null = NaN/inf was logged. */
	value: z.number().nullable(),
});
export type MetricPoint = z.infer<typeof MetricPointSchema>;

export const MetricsPageSchema = z.object({
	points: z.array(MetricPointSchema),
	/** Pass back as `after` to get only newer points. */
	cursor: z.number().int(),
	more: z.boolean(),
});
export type MetricsPage = z.infer<typeof MetricsPageSchema>;

export const MetricSummarySchema = z.object({
	/** null = the last logged value was NaN/inf. */
	last: z.number().nullable(),
	lastStep: z.number().int(),
	min: z.number().nullable(),
	max: z.number().nullable(),
	count: z.number().int(),
});
export type MetricSummary = z.infer<typeof MetricSummarySchema>;

export const RunSummarySchema = z.object({
	id: RunIdSchema,
	metrics: z.record(z.string(), MetricSummarySchema),
});
export type RunSummary = z.infer<typeof RunSummarySchema>;

/** Per metric key: [step, value] thinned for overlays. */
export const RunSeriesSchema = z.record(
	z.string(),
	z.array(z.tuple([z.number().int(), z.number().nullable()])),
);
export type RunSeries = z.infer<typeof RunSeriesSchema>;

export const ProbeSetupSchema = z.object({
	/** Absolute path of packages/forge-probe when running from the repo, else null. */
	packageDir: z.string().nullable(),
	exampleScript: z.string().nullable(),
});
export type ProbeSetup = z.infer<typeof ProbeSetupSchema>;

export const GpuSchema = z.object({
	index: z.number().int(),
	name: z.string(),
	utilization: z.number().nullable(),
	memoryUsed: z.number().nullable(),
	memoryTotal: z.number().nullable(),
	temperature: z.number().nullable(),
	power: z.number().nullable(),
	powerLimit: z.number().nullable(),
	fan: z.number().nullable(),
});
export type Gpu = z.infer<typeof GpuSchema>;

export const GpuSnapshotSchema = z.object({
	available: z.boolean(),
	reason: z.string().nullable(),
	driver: z.string().nullable(),
	gpus: z.array(GpuSchema),
});
export type GpuSnapshot = z.infer<typeof GpuSnapshotSchema>;

export const labChannels = defineChannels({
	'runs:list': { input: z.void(), output: z.array(RunSchema) },
	'runs:get': { input: RunIdSchema, output: RunDetailSchema },
	'runs:metrics': {
		input: z.object({ id: RunIdSchema, after: z.number().int().min(0) }),
		output: MetricsPageSchema,
	},
	'runs:delete': { input: RunIdSchema, output: z.void() },
	'runs:artifact': {
		input: z.object({
			id: RunIdSchema,
			kind: ArtifactKindSchema,
			name: z.string().min(1).max(100),
		}),
		output: ArtifactSchema,
	},
	'runs:summary': {
		input: z.array(RunIdSchema).min(1).max(12),
		output: z.array(RunSummarySchema),
	},
	'runs:series': {
		input: z.object({ id: RunIdSchema, maxPoints: z.number().int().min(50).max(10000) }),
		output: RunSeriesSchema,
	},
	'runs:setup': { input: z.void(), output: ProbeSetupSchema },
	'gpu:snapshot': { input: z.void(), output: GpuSnapshotSchema },
});
