import { z } from 'zod';

import { defineChannels } from '../define';

export const GitHubRepoSchema = z.discriminatedUnion('status', [
	z.object({ status: z.literal('no-folder') }),
	z.object({ status: z.literal('no-remote') }),
	z.object({ status: z.literal('no-token'), owner: z.string(), repo: z.string() }),
	z.object({
		status: z.literal('ok'),
		owner: z.string(),
		repo: z.string(),
		url: z.string(),
		defaultBranch: z.string(),
		private: z.boolean(),
		/** Login of the token's user. */
		viewer: z.string(),
	}),
]);
export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

const UserSchema = z.object({ login: z.string(), avatarUrl: z.string().nullable() });
const LabelSchema = z.object({ name: z.string(), color: z.string() });

export const PullSummarySchema = z.object({
	number: z.number().int(),
	title: z.string(),
	author: UserSchema,
	state: z.enum(['open', 'closed', 'merged']),
	draft: z.boolean(),
	headRef: z.string(),
	baseRef: z.string(),
	createdAt: z.number(),
	updatedAt: z.number(),
	comments: z.number().int(),
	labels: z.array(LabelSchema),
	url: z.string(),
	/** You're asked to review it. */
	reviewRequested: z.boolean(),
});
export type PullSummary = z.infer<typeof PullSummarySchema>;

export const CheckSchema = z.object({
	name: z.string(),
	status: z.enum(['queued', 'in_progress', 'completed', 'waiting', 'requested', 'pending']),
	conclusion: z.string().nullable(),
	url: z.string().nullable(),
});
export type Check = z.infer<typeof CheckSchema>;

export const PullFileSchema = z.object({
	path: z.string(),
	previousPath: z.string().nullable(),
	status: z.string(),
	additions: z.number().int(),
	deletions: z.number().int(),
	/** Unified diff hunk text; null for binary or too-large files. */
	patch: z.string().nullable(),
});
export type PullFile = z.infer<typeof PullFileSchema>;

export const PullDetailSchema = PullSummarySchema.extend({
	body: z.string(),
	headSha: z.string(),
	mergeable: z.boolean().nullable(),
	additions: z.number().int(),
	deletions: z.number().int(),
	changedFiles: z.number().int(),
	files: z.array(PullFileSchema),
	checks: z.array(CheckSchema),
});
export type PullDetail = z.infer<typeof PullDetailSchema>;

export const IssueSchema = z.object({
	number: z.number().int(),
	title: z.string(),
	author: UserSchema,
	state: z.enum(['open', 'closed']),
	createdAt: z.number(),
	updatedAt: z.number(),
	comments: z.number().int(),
	labels: z.array(LabelSchema),
	assignees: z.array(z.string()),
	url: z.string(),
});
export type Issue = z.infer<typeof IssueSchema>;

export const WorkflowRunSchema = z.object({
	id: z.number().int(),
	name: z.string(),
	title: z.string(),
	event: z.string(),
	status: z.string(),
	conclusion: z.string().nullable(),
	branch: z.string().nullable(),
	sha: z.string(),
	actor: z.string().nullable(),
	runNumber: z.number().int(),
	createdAt: z.number(),
	updatedAt: z.number(),
	url: z.string(),
});
export type WorkflowRun = z.infer<typeof WorkflowRunSchema>;

const StateSchema = z.enum(['open', 'closed', 'all']);

export const githubChannels = defineChannels({
	'github:repo': { input: z.void(), output: GitHubRepoSchema },
	'github:pulls': { input: z.object({ state: StateSchema }), output: z.array(PullSummarySchema) },
	'github:pull': {
		input: z.object({ number: z.number().int().positive() }),
		output: PullDetailSchema,
	},
	'github:issues': { input: z.object({ state: StateSchema }), output: z.array(IssueSchema) },
	'github:runs': { input: z.void(), output: z.array(WorkflowRunSchema) },
});
