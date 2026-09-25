import { z } from 'zod';

import { defineChannels } from '../define';

const IdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,100}$/);

export const VercelStatusSchema = z.discriminatedUnion('status', [
	z.object({ status: z.literal('no-token') }),
	z.object({
		status: z.literal('ok'),
		user: z.string(),
		teams: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() })),
		/** null = personal account. */
		teamId: z.string().nullable(),
	}),
]);
export type VercelStatus = z.infer<typeof VercelStatusSchema>;

export const DeploymentStateSchema = z.enum([
	'QUEUED',
	'INITIALIZING',
	'BUILDING',
	'READY',
	'ERROR',
	'CANCELED',
	'UNKNOWN',
]);
export type DeploymentState = z.infer<typeof DeploymentStateSchema>;

export const VercelProjectSchema = z.object({
	id: z.string(),
	name: z.string(),
	framework: z.string().nullable(),
	/** Git repo it deploys from, e.g. "martex-dev/forge". */
	repo: z.string().nullable(),
	production: z
		.object({
			id: z.string(),
			url: z.string(),
			state: DeploymentStateSchema,
			createdAt: z.number(),
		})
		.nullable(),
	updatedAt: z.number(),
});
export type VercelProject = z.infer<typeof VercelProjectSchema>;

export const DeploymentSchema = z.object({
	id: z.string(),
	projectId: z.string().nullable(),
	project: z.string(),
	url: z.string(),
	state: DeploymentStateSchema,
	target: z.enum(['production', 'preview']),
	createdAt: z.number(),
	commitMessage: z.string().nullable(),
	commitRef: z.string().nullable(),
	commitSha: z.string().nullable(),
	creator: z.string().nullable(),
	inspectorUrl: z.string().nullable(),
	/** Serving production traffic right now. */
	isCurrentProduction: z.boolean(),
});
export type Deployment = z.infer<typeof DeploymentSchema>;

export const LogLineSchema = z.object({
	t: z.number(),
	level: z.enum(['info', 'warn', 'error']),
	text: z.string(),
});
export type LogLine = z.infer<typeof LogLineSchema>;

const Target = z.object({ projectId: IdSchema, deploymentId: IdSchema });

export const vercelChannels = defineChannels({
	'vercel:status': { input: z.void(), output: VercelStatusSchema },
	'vercel:setTeam': { input: z.object({ teamId: IdSchema.nullable() }), output: z.void() },
	'vercel:projects': { input: z.void(), output: z.array(VercelProjectSchema) },
	'vercel:deployments': {
		input: z.object({ projectId: IdSchema }),
		output: z.array(DeploymentSchema),
	},
	'vercel:buildLogs': {
		input: z.object({ deploymentId: IdSchema }),
		output: z.array(LogLineSchema),
	},
	/** A bounded sample of recent runtime logs (the API streams indefinitely). */
	'vercel:runtimeLogs': { input: Target, output: z.array(LogLineSchema) },
	/** Write actions: the UI confirms first (CLAUDE.md §7). */
	'vercel:promote': { input: Target, output: z.void() },
	'vercel:rollback': { input: Target, output: z.void() },
});
