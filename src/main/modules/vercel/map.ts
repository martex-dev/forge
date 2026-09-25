import type {
	Deployment,
	DeploymentState,
	LogLine,
	VercelProject,
} from '@shared/ipc/channels/vercel';

const STATES = new Set<DeploymentState>([
	'QUEUED',
	'INITIALIZING',
	'BUILDING',
	'READY',
	'ERROR',
	'CANCELED',
]);

export function toState(raw: unknown): DeploymentState {
	const s = typeof raw === 'string' ? raw.toUpperCase() : '';
	return STATES.has(s as DeploymentState) ? (s as DeploymentState) : 'UNKNOWN';
}

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number => (typeof v === 'number' ? v : 0);
const https = (url: string): string => (url.startsWith('http') ? url : `https://${url}`);

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});

export function mapProject(raw: Obj): VercelProject {
	const link = obj(raw['link']);
	const prod = obj(obj(raw['targets'])['production']);
	const org = str(link['org']);
	const repo = str(link['repo']);
	return {
		id: String(raw['id']),
		name: String(raw['name']),
		framework: str(raw['framework']),
		repo: org && repo ? `${org}/${repo}` : repo,
		production: str(prod['id'])
			? {
					id: String(prod['id']),
					url: https(String(prod['url'] ?? '')),
					state: toState(prod['readyState']),
					createdAt: num(prod['createdAt']),
				}
			: null,
		updatedAt: num(raw['updatedAt']),
	};
}

export function mapDeployment(raw: Obj, currentProductionId: string | null): Deployment {
	const meta = obj(raw['meta']);
	const id = String(raw['uid'] ?? raw['id']);
	return {
		id,
		projectId: str(raw['projectId']),
		project: String(raw['name'] ?? ''),
		url: https(String(raw['url'] ?? '')),
		state: toState(raw['state'] ?? raw['readyState']),
		target: raw['target'] === 'production' ? 'production' : 'preview',
		createdAt: num(raw['created'] ?? raw['createdAt']),
		commitMessage: str(meta['githubCommitMessage'] ?? meta['gitlabCommitMessage']),
		commitRef: str(meta['githubCommitRef'] ?? meta['gitlabCommitRef']),
		commitSha: str(meta['githubCommitSha'] ?? meta['gitlabCommitSha']),
		creator: str(obj(raw['creator'])['username']),
		inspectorUrl: str(raw['inspectorUrl']),
		isCurrentProduction: currentProductionId === id,
	};
}

/** Build events come in two shapes over the API's history: {text} or {payload: {text}}. */
export function mapBuildEvents(events: unknown[]): LogLine[] {
	const out: LogLine[] = [];
	for (const e of events) {
		const event = obj(e);
		const payload = obj(event['payload']);
		const text = str(payload['text']) ?? str(event['text']);
		if (text === null) continue;
		const type = String(event['type'] ?? '');
		out.push({
			t: num(payload['date'] ?? event['created']),
			level: type === 'stderr' || /error/i.test(type) ? 'error' : 'info',
			text: text.replace(/\n$/, ''),
		});
	}
	return out;
}

/** One NDJSON line of runtime logs → a log line (null for keep-alives/garbage). */
export function mapRuntimeLine(line: string): LogLine | null {
	let raw: Obj;
	try {
		raw = obj(JSON.parse(line));
	} catch {
		return null;
	}
	const message = str(raw['message']);
	if (message === null) return null;
	const level = raw['level'] === 'error' ? 'error' : raw['level'] === 'warning' ? 'warn' : 'info';
	const request =
		str(raw['requestPath']) !== null
			? `${String(raw['requestMethod'] ?? 'GET')} ${String(raw['requestPath'])} ${String(raw['responseStatusCode'] ?? '')} · `
			: '';
	return { t: num(raw['timestampInMs']), level, text: `${request}${message}` };
}
