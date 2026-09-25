import { execFile } from 'node:child_process';

import { Octokit } from '@octokit/rest';

import type { Issue, PullDetail, PullSummary, WorkflowRun } from '@shared/ipc/channels/github';

import { ForgeError } from '../../core/errors';
import { mapChecks, mapFile, mapIssues, mapPull, mapRun } from './map';
import { pickRemote } from './remote';

// A type alias (not an interface) so it fits Octokit's index-signature parameter types.
export type RepoRef = { owner: string; repo: string };

const MAX_FILES = 300;

/** `git remote -v` in the folder, with no credential helpers or editors inherited. */
export function readRemotes(root: string): Promise<Array<{ name: string; url: string }>> {
	const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
	delete env['GIT_ASKPASS'];
	delete env['GIT_EDITOR'];
	return new Promise((resolve) => {
		execFile(
			'git',
			['-C', root, 'remote', '-v'],
			{ env, windowsHide: true, timeout: 5_000 },
			(error, stdout) => {
				// Not a repo, or git missing: simply no remotes.
				if (error) return resolve([]);
				const remotes = stdout
					.split('\n')
					.map((line) => /^(\S+)\s+(\S+)\s+\(fetch\)/.exec(line.trim()))
					.flatMap((m) => (m?.[1] && m[2] ? [{ name: m[1], url: m[2] }] : []));
				resolve(remotes);
			},
		);
	});
}

export async function repoOfFolder(root: string): Promise<RepoRef | null> {
	return pickRemote(await readRemotes(root));
}

/** Turns Octokit failures into messages that tell Marto what to do. */
export function toForgeError(error: unknown): ForgeError {
	const status = (error as { status?: number }).status;
	const headers = (error as { response?: { headers?: Record<string, string> } }).response
		?.headers;
	if (status === 401) {
		return new ForgeError(
			'GITHUB_BAD_TOKEN',
			'GitHub rejected the token. Update it in Settings → Secrets.',
		);
	}
	if (status === 403 && headers?.['x-ratelimit-remaining'] === '0') {
		const reset = Number(headers['x-ratelimit-reset'] ?? 0) * 1000;
		const minutes = Math.max(1, Math.round((reset - Date.now()) / 60_000));
		return new ForgeError(
			'GITHUB_RATE_LIMIT',
			`GitHub rate limit reached; resets in ~${minutes} min.`,
		);
	}
	if (status === 403 || status === 404) {
		return new ForgeError(
			'GITHUB_NO_ACCESS',
			"Repository not found, or the token can't read it (check the token's repository access).",
		);
	}
	if (error instanceof ForgeError) return error;
	return new ForgeError(
		'GITHUB_UNAVAILABLE',
		`GitHub request failed: ${String((error as Error).message ?? error)}`,
	);
}

export class GitHubService {
	private cached: { token: string; octokit: Octokit; viewer: Promise<string> } | null = null;

	constructor(
		private readonly getToken: () => string | null,
		/** Only for tests: a local mock of the GitHub REST API. */
		private readonly baseUrl?: string,
	) {}

	hasToken(): boolean {
		return Boolean(this.getToken());
	}

	private client(): { octokit: Octokit; viewer: Promise<string> } {
		const token = this.getToken();
		if (!token)
			throw new ForgeError('GITHUB_NO_TOKEN', 'Add a GitHub token in Settings → Secrets.');
		if (this.cached?.token !== token) {
			const octokit = new Octokit({
				auth: token,
				userAgent: 'Forge (personal desktop app)',
				...(this.baseUrl ? { baseUrl: this.baseUrl } : {}),
				request: { timeout: 15_000 },
			});
			const viewer = octokit.rest.users.getAuthenticated().then((r) => r.data.login);
			// Don't cache a failed lookup (e.g. offline): the next call retries.
			viewer.catch(() => {
				if (this.cached?.token === token) this.cached = null;
			});
			this.cached = { token, octokit, viewer };
		}
		return this.cached;
	}

	private async call<T>(fn: (octokit: Octokit, viewer: string) => Promise<T>): Promise<T> {
		try {
			const { octokit, viewer } = this.client();
			return await fn(octokit, await viewer);
		} catch (error) {
			throw toForgeError(error);
		}
	}

	info(
		ref: RepoRef,
	): Promise<{ url: string; defaultBranch: string; private: boolean; viewer: string }> {
		return this.call(async (octokit, viewer) => {
			const { data } = await octokit.rest.repos.get(ref);
			return {
				url: data.html_url,
				defaultBranch: data.default_branch,
				private: data.private,
				viewer,
			};
		});
	}

	pulls(ref: RepoRef, state: 'open' | 'closed' | 'all'): Promise<PullSummary[]> {
		return this.call(async (octokit, viewer) => {
			const { data } = await octokit.rest.pulls.list({
				...ref,
				state,
				sort: 'updated',
				direction: 'desc',
				per_page: 50,
			});
			return data.map((p) => mapPull(p, viewer));
		});
	}

	pull(ref: RepoRef, number: number): Promise<PullDetail> {
		return this.call(async (octokit, viewer) => {
			const { data: p } = await octokit.rest.pulls.get({ ...ref, pull_number: number });
			const [files, checkRuns, status] = await Promise.all([
				octokit.paginate(
					octokit.rest.pulls.listFiles,
					{ ...ref, pull_number: number, per_page: 100 },
					(r, done) => {
						if (r.data.length && r.data.length >= MAX_FILES) done();
						return r.data;
					},
				),
				octokit.rest.checks
					.listForRef({ ...ref, ref: p.head.sha, per_page: 100 })
					.then((r) => r.data.check_runs),
				octokit.rest.repos
					.getCombinedStatusForRef({ ...ref, ref: p.head.sha })
					.then((r) => r.data.statuses),
			]);
			return {
				...mapPull(p, viewer),
				body: p.body ?? '',
				headSha: p.head.sha,
				mergeable: p.mergeable,
				additions: p.additions,
				deletions: p.deletions,
				changedFiles: p.changed_files,
				files: files.slice(0, MAX_FILES).map(mapFile),
				checks: mapChecks(checkRuns, status),
			};
		});
	}

	issues(ref: RepoRef, state: 'open' | 'closed' | 'all'): Promise<Issue[]> {
		return this.call(async (octokit) => {
			const { data } = await octokit.rest.issues.listForRepo({
				...ref,
				state,
				sort: 'updated',
				per_page: 50,
			});
			return mapIssues(data);
		});
	}

	runs(ref: RepoRef): Promise<WorkflowRun[]> {
		return this.call(async (octokit) => {
			const { data } = await octokit.rest.actions.listWorkflowRunsForRepo({
				...ref,
				per_page: 30,
			});
			return data.workflow_runs.map(mapRun);
		});
	}

	viewer(): Promise<string> {
		return this.call((_octokit, viewer) => Promise.resolve(viewer));
	}
}
