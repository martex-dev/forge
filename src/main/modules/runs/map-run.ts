import { z } from 'zod';

import {
	ArtifactKindSchema,
	type Run,
	type RunDetail,
	RunStatusSchema,
} from '@shared/ipc/channels/lab';

/** The sidecar's snake_case run, validated at the process boundary. Times are epoch seconds. */
export const SidecarRunSchema = z.object({
	id: z.string(),
	name: z.string(),
	project: z.string().nullable(),
	status: RunStatusSchema,
	error: z.string().nullable(),
	started_at: z.number(),
	ended_at: z.number().nullable(),
	updated_at: z.number(),
	pid: z.number().int().nullable(),
	host: z.string().nullable(),
	script: z.string().nullable(),
	last_step: z.number().int().nullable(),
	metric_keys: z.array(z.string()),
});
export const SidecarRunDetailSchema = SidecarRunSchema.extend({
	config: z.record(z.string(), z.unknown()),
	artifacts: z
		.array(z.object({ kind: ArtifactKindSchema, name: z.string(), created_at: z.number() }))
		.default([]),
});

const ms = (seconds: number): number => Math.round(seconds * 1000);

export function toRun(r: z.infer<typeof SidecarRunSchema>): Run {
	return {
		id: r.id,
		name: r.name,
		project: r.project,
		status: r.status,
		error: r.error,
		startedAt: ms(r.started_at),
		endedAt: r.ended_at === null ? null : ms(r.ended_at),
		updatedAt: ms(r.updated_at),
		pid: r.pid,
		host: r.host,
		script: r.script,
		lastStep: r.last_step,
		metricKeys: r.metric_keys,
	};
}

export function toRunDetail(r: z.infer<typeof SidecarRunDetailSchema>): RunDetail {
	return {
		...toRun(r),
		config: r.config,
		artifacts: r.artifacts.map((a) => ({
			kind: a.kind,
			name: a.name,
			createdAt: ms(a.created_at),
		})),
	};
}
