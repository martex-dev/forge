import { randomBytes } from 'node:crypto';

import type { SidecarStatus } from '@shared/ipc/channels/sidecar';

import { ForgeError } from '../errors';
import { backoffDelayMs, MAX_RESTART_ATTEMPTS } from './backoff';

export interface SidecarProcess {
	pid: number | undefined;
	onExit(listener: (code: number | null) => void): void;
	onOutput(listener: (line: string, stream: 'stdout' | 'stderr') => void): void;
}

export interface HealthInfo {
	version: string;
	python: string;
}

export interface SidecarDeps {
	spawn(env: Record<string, string>): SidecarProcess;
	findPort(): Promise<number>;
	/** Resolves with health info, or null if not (yet) healthy. Must never throw. */
	checkHealth(baseUrl: string, token: string): Promise<HealthInfo | null>;
	killTree(pid: number): Promise<void>;
	sleep(ms: number): Promise<void>;
	onStatus(status: SidecarStatus): void;
	/** Called once when restarts are exhausted. */
	onGaveUp(message: string): void;
	log: {
		info(msg: string, meta?: unknown): void;
		warn(msg: string, meta?: unknown): void;
		error(msg: string, meta?: unknown): void;
	};
	startupTimeoutMs?: number;
	pollIntervalMs?: number;
	/** Passed as FORGE_DATA_DIR (sidecar caches). */
	dataDir?: string;
}

/**
 * Owns the Python sidecar: launch with a fresh port + token, wait for /health, restart with
 * exponential backoff on crash, and kill the whole process tree on stop.
 */
/** FastAPI errors look like {"detail": "..."}; show that text rather than raw JSON. */
export function extractDetail(body: string): string {
	try {
		const parsed = JSON.parse(body) as { detail?: unknown };
		if (typeof parsed.detail === 'string') return parsed.detail;
	} catch {
		// Not JSON; fall through to the raw text.
	}
	return body;
}

export class SidecarManager {
	private status: SidecarStatus = { state: 'stopped', attempt: 0 };
	private child: SidecarProcess | null = null;
	private port = 0;
	private token = '';
	private stopping = false;
	/** Bumped on every launch so exit handlers of old processes are ignored. */
	private generation = 0;

	constructor(private readonly deps: SidecarDeps) {}

	getStatus(): SidecarStatus {
		return this.status;
	}

	get baseUrl(): string {
		return `http://127.0.0.1:${this.port}`;
	}

	async start(): Promise<void> {
		this.stopping = false;
		await this.launch(0);
	}

	/** Manual restart from the UI: resets the attempt counter. */
	async restart(): Promise<void> {
		await this.killCurrent();
		this.stopping = false;
		await this.launch(0);
	}

	async stop(): Promise<void> {
		this.stopping = true;
		await this.killCurrent();
		this.setStatus({ state: 'stopped', attempt: 0 });
	}

	/** Authenticated request to the sidecar. Only main calls this; the renderer goes through IPC. */
	async request<T>(method: 'GET' | 'POST' | 'PUT' | 'DELETE', path: string, body?: unknown): Promise<T> {
		if (this.status.state !== 'ready') {
			throw new ForgeError('SIDECAR_UNAVAILABLE', `Python sidecar is ${this.status.state}`);
		}
		const response = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${this.token}`,
				...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: AbortSignal.timeout(30_000),
		});
		if (!response.ok) {
			const text = await response.text().catch(() => '');
			const detail = extractDetail(text);
			throw new ForgeError(`SIDECAR_HTTP_${response.status}`, detail.slice(0, 500) || response.statusText);
		}
		return (await response.json()) as T;
	}

	private async launch(attempt: number): Promise<void> {
		const generation = ++this.generation;
		this.setStatus({ state: attempt === 0 ? 'starting' : 'restarting', attempt });

		try {
			this.port = await this.deps.findPort();
		} catch (error) {
			this.deps.log.error('[sidecar] no free port', error);
			return this.scheduleRestart(attempt, generation);
		}
		this.token = randomBytes(32).toString('hex');

		let exited = false;
		const child = this.deps.spawn({
			FORGE_PORT: String(this.port),
			FORGE_TOKEN: this.token,
			FORGE_PARENT_PID: String(process.pid),
			PYTHONUNBUFFERED: '1',
			...(this.deps.dataDir ? { FORGE_DATA_DIR: this.deps.dataDir } : {}),
		});
		this.child = child;
		child.onOutput((line, stream) => {
			if (stream === 'stderr') this.deps.log.warn(`[sidecar] ${line}`);
			else this.deps.log.info(`[sidecar] ${line}`);
		});
		child.onExit((code) => {
			exited = true;
			if (generation !== this.generation || this.stopping) return;
			this.deps.log.warn('[sidecar] exited unexpectedly', { code });
			this.child = null;
			void this.scheduleRestart(this.status.state === 'ready' ? 0 : attempt, generation);
		});

		const deadline = Date.now() + (this.deps.startupTimeoutMs ?? 60_000);
		const interval = this.deps.pollIntervalMs ?? 250;
		while (Date.now() < deadline) {
			if (exited || generation !== this.generation || this.stopping) return;
			const health = await this.deps.checkHealth(this.baseUrl, this.token);
			if (health && generation === this.generation && !this.stopping) {
				this.setStatus({ state: 'ready', attempt: 0, version: health.version, python: health.python });
				this.deps.log.info('[sidecar] ready', { port: this.port, ...health });
				return;
			}
			await this.deps.sleep(interval);
		}

		this.deps.log.error('[sidecar] health check timed out');
		await this.killCurrent();
		// killCurrent bumped the generation to silence the old exit handler; continue under the new one.
		await this.scheduleRestart(attempt, this.generation);
	}

	private async scheduleRestart(previousAttempt: number, generation: number): Promise<void> {
		if (this.stopping || generation !== this.generation) return;
		const attempt = previousAttempt + 1;
		if (attempt > MAX_RESTART_ATTEMPTS) {
			const message = `Gave up after ${MAX_RESTART_ATTEMPTS} restart attempts`;
			this.setStatus({ state: 'error', attempt: MAX_RESTART_ATTEMPTS, message });
			this.deps.onGaveUp(message);
			return;
		}
		this.setStatus({ state: 'restarting', attempt });
		await this.deps.sleep(backoffDelayMs(attempt));
		if (this.stopping || generation !== this.generation) return;
		await this.launch(attempt);
	}

	private async killCurrent(): Promise<void> {
		this.generation++;
		const child = this.child;
		this.child = null;
		if (child?.pid) await this.deps.killTree(child.pid);
	}

	private setStatus(status: SidecarStatus): void {
		this.status = status;
		this.deps.onStatus(status);
	}
}
