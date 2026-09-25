import type { AiMessage, AiProvider } from '@shared/ipc/channels/ai';

import type { SseEvent } from './sse';

const MAX_TOKENS = 8_192;

export interface ProviderRequest {
	url: string;
	headers: Record<string, string>;
	body: unknown;
}

export interface StreamChunk {
	text?: string;
	done?: boolean;
	error?: string;
	inputTokens?: number;
	outputTokens?: number;
}

export const PROVIDER_SECRET: Record<AiProvider, string> = {
	anthropic: 'anthropic.key',
	openai: 'openai.key',
	gemini: 'gemini.key',
};

/** The HTTP request that starts a streaming completion for each provider. */
export function buildRequest(
	provider: AiProvider,
	model: string,
	key: string,
	system: string,
	messages: AiMessage[],
): ProviderRequest {
	switch (provider) {
		case 'anthropic':
			return {
				url: 'https://api.anthropic.com/v1/messages',
				headers: {
					'x-api-key': key,
					'anthropic-version': '2023-06-01',
					'content-type': 'application/json',
				},
				body: { model, max_tokens: MAX_TOKENS, system, messages, stream: true },
			};
		case 'openai':
			return {
				url: 'https://api.openai.com/v1/chat/completions',
				headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
				body: {
					model,
					stream: true,
					stream_options: { include_usage: true },
					messages: [{ role: 'system', content: system }, ...messages],
				},
			};
		case 'gemini':
			return {
				url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
				headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
				body: {
					systemInstruction: { parts: [{ text: system }] },
					contents: messages.map((m) => ({
						role: m.role === 'assistant' ? 'model' : 'user',
						parts: [{ text: m.content }],
					})),
				},
			};
	}
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' ? (v as Obj) : {});
const parse = (data: string): Obj | null => {
	try {
		return obj(JSON.parse(data));
	} catch {
		return null;
	}
};

/** One SSE event → what it means for the conversation. */
export function parseEvent(provider: AiProvider, event: SseEvent): StreamChunk {
	if (provider === 'openai' && event.data === '[DONE]') return { done: true };
	const json = parse(event.data);
	if (!json) return {};
	if (json['error']) {
		const error = obj(json['error']);
		return { error: String(error['message'] ?? JSON.stringify(json['error'])) };
	}
	switch (provider) {
		case 'anthropic': {
			const type = String(json['type'] ?? event.event ?? '');
			if (type === 'content_block_delta') {
				const delta = obj(json['delta']);
				return delta['type'] === 'text_delta' ? { text: String(delta['text'] ?? '') } : {};
			}
			if (type === 'message_start') {
				const usage = obj(obj(json['message'])['usage']);
				return { inputTokens: Number(usage['input_tokens'] ?? 0) };
			}
			if (type === 'message_delta')
				return { outputTokens: Number(obj(json['usage'])['output_tokens'] ?? 0) };
			if (type === 'message_stop') return { done: true };
			return {};
		}
		case 'openai': {
			const choice = obj((json['choices'] as unknown[] | undefined)?.[0]);
			const usage = obj(json['usage']);
			return {
				...(typeof obj(choice['delta'])['content'] === 'string'
					? { text: String(obj(choice['delta'])['content']) }
					: {}),
				...(usage['prompt_tokens'] !== undefined
					? {
							inputTokens: Number(usage['prompt_tokens']),
							outputTokens: Number(usage['completion_tokens'] ?? 0),
						}
					: {}),
			};
		}
		case 'gemini': {
			const candidate = obj((json['candidates'] as unknown[] | undefined)?.[0]);
			const parts = (obj(candidate['content'])['parts'] as unknown[] | undefined) ?? [];
			const text = parts.map((p) => String(obj(p)['text'] ?? '')).join('');
			const usage = obj(json['usageMetadata']);
			return {
				...(text ? { text } : {}),
				...(usage['promptTokenCount'] !== undefined
					? {
							inputTokens: Number(usage['promptTokenCount']),
							outputTokens: Number(usage['candidatesTokenCount'] ?? 0),
						}
					: {}),
			};
		}
	}
}
