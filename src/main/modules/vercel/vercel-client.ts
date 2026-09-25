import type { Deployment, LogLine, VercelProject } from '@shared/ipc/channels/vercel';

import { ForgeError } from '../../core/errors';
import { mapBuildEvents, mapDeployment, mapProject, mapRuntimeLine } from './map';

type Obj = Record<string, unknown>;
const RUNTIME_SAMPLE_MS = 2_500;
const RUNTIME_MAX_LINES = 300;
const MAX_BUILD_LINES = 5_000;

export class VercelClient {
	constructor(
		private readonly getToken: () => string | null,
		/** Only for tests: a local mock of the Vercel REST API. */
		private readonly baseUrl = 'https://api.vercel.com',
	) {}

	hasToken(): boolean {
		return Boolean(this.getToken());
	}

	private url(path: string, teamId: string | null, query: Record<string, string> = {}): string {
		const url = new URL(path, this.baseUrl);
		for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
		if (teamId) url.searchParams.set('teamId', teamId);
		return url.toString();
	}

	private headers(): Record<string, string> {
		const token = this.getToken();
		if (!token)
			throw new ForgeError('VERCEL_NO_TOKEN', 'Add a Vercel token in Settings → Secrets.');
		return { Authorization: `Bearer ${token}`, 'User-Agent': 'Forge (personal desktop app)' };
	}

	private async request(
		url: string,
		method: 'GET' | 'POST' = 'GET',
		body?: unknown,
	): Promise<Response> {
		let response: Response;
		try {
			response = await fetch(url, {
				method,
				headers: {
					...this.headers(),
					...(body ? { 'Content-Type': 'application/json' } : {}),
				},
				...(body ? { body: JSON.stringify(body) } : {}),
				signal: AbortSignal.timeout(15_000),
			});
		} catch (error) {
			if (error instanceof ForgeError) throw error;
			throw new ForgeError(
				'VERCEL_UNAVAILABLE',
				`Could not reach Vercel: ${String(error)}`,
				error,
			);
		}
		if (response.ok) return response;
		const detail = await response
			.json()
			.then((j: unknown) =>
				String((j as { error?: { message?: string } }).error?.message ?? ''),
			)
			.catch(() => '');
		if (response.status === 401 || response.status === 403) {
			throw new ForgeError(
				'VERCEL_BAD_TOKEN',
				`Vercel refused the request${detail ? ` (${detail})` : ''}. Check the token and team in Settings → Secrets.`,
			);
		}
		if (response.status === 429) {
			throw new ForgeError(
				'VERCEL_RATE_LIMIT',
				'Vercel rate limit reached; try again in a minute.',
			);
		}
		throw new ForgeError(
			`VERCEL_HTTP_${response.status}`,
			detail || `Vercel returned ${response.status}`,
		);
	}

	private async json(
		path: string,
		teamId: string | null,
		query?: Record<string, string>,
	): Promise<Obj> {
		return (await (await this.request(this.url(path, teamId, query))).json()) as Obj;
	}

	async user(): Promise<string> {
		const data = await this.json('/v2/user', null);
		const user = (data['user'] ?? {}) as Obj;
		return String(user['username'] ?? user['email'] ?? 'you');
	}

	async teams(): Promise<Array<{ id: string; name: string; slug: string }>> {
		const data = await this.json('/v2/teams', null);
		return ((data['teams'] as Obj[] | undefined) ?? []).map((t) => ({
			id: String(t['id']),
			name: String(t['name'] ?? t['slug']),
			slug: String(t['slug'] ?? ''),
		}));
	}

	async projects(teamId: string | null): Promise<VercelProject[]> {
		const data = await this.json('/v9/projects', teamId, { limit: '100' });
		return ((data['projects'] as Obj[] | undefined) ?? [])
			.map(mapProject)
			.sort((a, b) => b.updatedAt - a.updatedAt);
	}

	async deployments(projectId: string, teamId: string | null): Promise<Deployment[]> {
		const [project, list] = await Promise.all([
			this.json(`/v9/projects/${encodeURIComponent(projectId)}`, teamId),
			this.json('/v6/deployments', teamId, { projectId, limit: '30' }),
		]);
		const liveId = mapProject(project).production?.id ?? null;
		return ((list['deployments'] as Obj[] | undefined) ?? []).map((d) =>
			mapDeployment({ projectId, ...d }, liveId),
		);
	}

	/** Latest deployments across every project (for notifications). */
	async recentDeployments(teamId: string | null): Promise<Deployment[]> {
		const list = await this.json('/v6/deployments', teamId, { limit: '20' });
		return ((list['deployments'] as Obj[] | undefined) ?? []).map((d) =>
			mapDeployment(d, null),
		);
	}

	async buildLogs(deploymentId: string, teamId: string | null): Promise<LogLine[]> {
		const response = await this.request(
			this.url(`/v3/deployments/${encodeURIComponent(deploymentId)}/events`, teamId, {
				builds: '1',
				direction: 'forward',
				limit: String(MAX_BUILD_LINES),
			}),
		);
		const data: unknown = await response.json();
		return mapBuildEvents(Array.isArray(data) ? data : []).slice(-MAX_BUILD_LINES);
	}

	/** Runtime logs stream forever; read what arrives within a short window. */
	async runtimeLogs(
		projectId: string,
		deploymentId: string,
		teamId: string | null,
	): Promise<LogLine[]> {
		const response = await this.request(
			this.url(
				`/v1/projects/${encodeURIComponent(projectId)}/deployments/${encodeURIComponent(deploymentId)}/runtime-logs`,
				teamId,
			),
		);
		const reader = response.body?.getReader();
		if (!reader) return [];
		const lines: LogLine[] = [];
		const decoder = new TextDecoder();
		let buffer = '';
		const deadline = Date.now() + RUNTIME_SAMPLE_MS;
		try {
			while (Date.now() < deadline && lines.length < RUNTIME_MAX_LINES) {
				const chunk = await Promise.race([
					reader.read(),
					new Promise<null>((resolve) =>
						setTimeout(() => resolve(null), Math.max(0, deadline - Date.now())),
					),
				]);
				if (chunk === null || chunk.done) break;
				buffer += decoder.decode(chunk.value, { stream: true });
				const parts = buffer.split('\n');
				buffer = parts.pop() ?? '';
				for (const part of parts) {
					const line = mapRuntimeLine(part);
					if (line) lines.push(line);
				}
			}
		} finally {
			await reader.cancel().catch(() => undefined);
		}
		const tail = mapRuntimeLine(buffer);
		if (tail) lines.push(tail);
		return lines.slice(0, RUNTIME_MAX_LINES);
	}

	async promote(projectId: string, deploymentId: string, teamId: string | null): Promise<void> {
		await this.request(
			this.url(
				`/v10/projects/${encodeURIComponent(projectId)}/promote/${encodeURIComponent(deploymentId)}`,
				teamId,
			),
			'POST',
		);
	}

	async rollback(projectId: string, deploymentId: string, teamId: string | null): Promise<void> {
		await this.request(
			this.url(
				`/v9/projects/${encodeURIComponent(projectId)}/rollback/${encodeURIComponent(deploymentId)}`,
				teamId,
			),
			'POST',
		);
	}
}
