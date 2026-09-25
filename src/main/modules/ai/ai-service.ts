import { execFile } from 'node:child_process';

import type { AiContext, AiMessage, AiProvider } from '@shared/ipc/channels/ai';

import { buildSystem } from './prompt';
import { buildRequest, parseEvent } from './providers';
import { SseParser } from './sse';

export interface StreamSink {
	delta(text: string): void;
	done(
		usage: { inputTokens: number | null; outputTokens: number | null },
		cancelled: boolean,
	): void;
	error(message: string): void;
}

const MAX_DIFF = 200_000;

/** Readable message from a provider's error body ({error: {message}} in all three APIs). */
export async function describeHttpError(provider: AiProvider, response: Response): Promise<string> {
	const text = await response.text().catch(() => '');
	let message = '';
	try {
		const json = JSON.parse(text) as { error?: { message?: string } | string };
		message = typeof json.error === 'string' ? json.error : (json.error?.message ?? '');
	} catch {
		message = text.slice(0, 300);
	}
	const hint =
		response.status === 401 || response.status === 403
			? ' Check the API key in Settings → Secrets.'
			: response.status === 404
				? ' Check the model name.'
				: response.status === 429
					? ' Rate limited or out of credit.'
					: '';
	return `${provider} returned ${response.status}${message ? `: ${message}` : ''}.${hint}`;
}

export class AiService {
	private readonly running = new Map<string, AbortController>();

	constructor(
		private readonly getKey: (provider: AiProvider) => string | null,
		/** Tests only: send every provider's request to this origin instead. */
		private readonly baseOverride?: string,
	) {}

	cancel(requestId: string): void {
		this.running.get(requestId)?.abort();
	}

	cancelAll(): void {
		for (const controller of this.running.values()) controller.abort();
	}

	async stream(
		requestId: string,
		provider: AiProvider,
		model: string,
		messages: AiMessage[],
		context: AiContext[],
		sink: StreamSink,
	): Promise<void> {
		const key = this.getKey(provider);
		if (!key) {
			sink.error(`No ${provider} API key. Add it in Settings → Secrets.`);
			return;
		}
		const request = buildRequest(provider, model, key, buildSystem(context), messages);
		const url = this.baseOverride
			? this.baseOverride + new URL(request.url).pathname
			: request.url;
		const controller = new AbortController();
		this.running.set(requestId, controller);
		let inputTokens: number | null = null;
		let outputTokens: number | null = null;
		try {
			const response = await fetch(url, {
				method: 'POST',
				headers: request.headers,
				body: JSON.stringify(request.body),
				signal: controller.signal,
			});
			if (!response.ok || !response.body) {
				sink.error(await describeHttpError(provider, response));
				return;
			}
			const parser = new SseParser();
			const decoder = new TextDecoder();
			const reader = response.body.getReader();
			for (;;) {
				const { value, done } = await reader.read();
				if (done) break;
				for (const event of parser.push(decoder.decode(value, { stream: true }))) {
					const chunk = parseEvent(provider, event);
					if (chunk.error) {
						sink.error(`${provider}: ${chunk.error}`);
						await reader.cancel().catch(() => undefined);
						return;
					}
					if (chunk.text) sink.delta(chunk.text);
					if (chunk.inputTokens !== undefined) inputTokens = chunk.inputTokens;
					if (chunk.outputTokens !== undefined) outputTokens = chunk.outputTokens;
				}
			}
			sink.done({ inputTokens, outputTokens }, false);
		} catch (error) {
			if (controller.signal.aborted) sink.done({ inputTokens, outputTokens }, true);
			else
				sink.error(
					`Could not reach ${provider}: ${error instanceof Error ? error.message : String(error)}`,
				);
		} finally {
			this.running.delete(requestId);
		}
	}
}

/** Working-tree + staged changes against HEAD, capped for the context window. */
export function gitDiff(root: string): Promise<{ diff: string; truncated: boolean }> {
	const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
	delete env['GIT_ASKPASS'];
	delete env['GIT_EDITOR'];
	return new Promise((resolve) => {
		execFile(
			'git',
			['-C', root, 'diff', 'HEAD', '--no-color', '--no-ext-diff'],
			{ env, windowsHide: true, maxBuffer: 20 * 1024 * 1024, timeout: 10_000 },
			(error, stdout) => {
				if (error && !stdout) return resolve({ diff: '', truncated: false });
				resolve({ diff: stdout.slice(0, MAX_DIFF), truncated: stdout.length > MAX_DIFF });
			},
		);
	});
}
