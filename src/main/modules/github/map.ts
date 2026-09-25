import type { Check, Issue, PullFile, PullSummary, WorkflowRun } from '@shared/ipc/channels/github';

// Minimal shapes of the GitHub REST responses we read. Octokit's full types are structurally
// compatible; keeping these small makes the mappers easy to test with plain fixtures.
interface RawUser {
	login: string;
	avatar_url?: string | null;
}
interface RawLabel {
	name?: string;
	color?: string | null;
}
type LabelLike = RawLabel | string;

export interface RawPull {
	number: number;
	title: string;
	user: RawUser | null;
	state: string;
	draft?: boolean | null;
	merged_at?: string | null;
	head: { ref: string; sha: string };
	base: { ref: string };
	created_at: string;
	updated_at: string;
	comments?: number;
	labels: LabelLike[];
	html_url: string;
	requested_reviewers?: Array<RawUser | null> | null;
}

export interface RawIssue {
	number: number;
	title: string;
	user: RawUser | null;
	state: string;
	created_at: string;
	updated_at: string;
	comments: number;
	labels: LabelLike[];
	assignees?: Array<RawUser | null> | null;
	html_url: string;
	pull_request?: unknown;
}

export interface RawRun {
	id: number;
	name?: string | null;
	display_title?: string;
	event: string;
	status: string | null;
	conclusion: string | null;
	head_branch: string | null;
	head_sha: string;
	actor?: RawUser | null;
	run_number: number;
	created_at: string;
	updated_at: string;
	html_url: string;
}

export interface RawFile {
	filename: string;
	previous_filename?: string;
	status: string;
	additions: number;
	deletions: number;
	patch?: string;
}

export interface RawCheckRun {
	name: string;
	status: string;
	conclusion: string | null;
	html_url?: string | null;
}
export interface RawStatus {
	context: string;
	state: string;
	target_url?: string | null;
}

const time = (iso: string): number => Date.parse(iso);
const user = (u: RawUser | null): { login: string; avatarUrl: string | null } => ({
	login: u?.login ?? 'ghost',
	avatarUrl: u?.avatar_url ?? null,
});
const labels = (list: LabelLike[]): Array<{ name: string; color: string }> =>
	list.map((l) =>
		typeof l === 'string'
			? { name: l, color: '6b7280' }
			: { name: l.name ?? '', color: l.color ?? '6b7280' },
	);

export function mapPull(raw: RawPull, viewer: string | null): PullSummary {
	return {
		number: raw.number,
		title: raw.title,
		author: user(raw.user),
		state: raw.merged_at ? 'merged' : raw.state === 'closed' ? 'closed' : 'open',
		draft: raw.draft ?? false,
		headRef: raw.head.ref,
		baseRef: raw.base.ref,
		createdAt: time(raw.created_at),
		updatedAt: time(raw.updated_at),
		comments: raw.comments ?? 0,
		labels: labels(raw.labels),
		url: raw.html_url,
		reviewRequested:
			viewer !== null &&
			(raw.requested_reviewers ?? []).some(
				(r) => r?.login.toLowerCase() === viewer.toLowerCase(),
			),
	};
}

/** The issues endpoint also returns pull requests; those are dropped. */
export function mapIssues(list: RawIssue[]): Issue[] {
	return list
		.filter((i) => !i.pull_request)
		.map((i) => ({
			number: i.number,
			title: i.title,
			author: user(i.user),
			state: i.state === 'closed' ? 'closed' : 'open',
			createdAt: time(i.created_at),
			updatedAt: time(i.updated_at),
			comments: i.comments,
			labels: labels(i.labels),
			assignees: (i.assignees ?? []).flatMap((a) => (a ? [a.login] : [])),
			url: i.html_url,
		}));
}

export function mapRun(raw: RawRun): WorkflowRun {
	return {
		id: raw.id,
		name: raw.name ?? 'workflow',
		title: raw.display_title ?? raw.name ?? '',
		event: raw.event,
		status: raw.status ?? 'unknown',
		conclusion: raw.conclusion,
		branch: raw.head_branch,
		sha: raw.head_sha,
		actor: raw.actor?.login ?? null,
		runNumber: raw.run_number,
		createdAt: time(raw.created_at),
		updatedAt: time(raw.updated_at),
		url: raw.html_url,
	};
}

export function mapFile(raw: RawFile): PullFile {
	return {
		path: raw.filename,
		previousPath: raw.previous_filename ?? null,
		status: raw.status,
		additions: raw.additions,
		deletions: raw.deletions,
		patch: raw.patch ?? null,
	};
}

const CHECK_STATUSES = new Set([
	'queued',
	'in_progress',
	'completed',
	'waiting',
	'requested',
	'pending',
]);

/** Check runs (GitHub Actions, apps) and legacy commit statuses, as one list. */
export function mapChecks(runs: RawCheckRun[], statuses: RawStatus[]): Check[] {
	const fromRuns: Check[] = runs.map((r) => ({
		name: r.name,
		status: (CHECK_STATUSES.has(r.status) ? r.status : 'pending') as Check['status'],
		conclusion: r.conclusion,
		url: r.html_url ?? null,
	}));
	const fromStatuses: Check[] = statuses.map((s) => ({
		name: s.context,
		status: s.state === 'pending' ? 'pending' : 'completed',
		conclusion: s.state === 'pending' ? null : s.state === 'error' ? 'failure' : s.state,
		url: s.target_url ?? null,
	}));
	return [...fromRuns, ...fromStatuses];
}
