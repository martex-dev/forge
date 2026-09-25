import { create } from 'zustand';

import type { AiContext, AiProvider } from '@shared/ipc/channels/ai';

import { call } from '../../lib/ipc';

export interface ChatMessage {
	id: string;
	role: 'user' | 'assistant';
	content: string;
	/** Context sent with a user message (shown as chips). */
	context?: AiContext[];
	provider?: AiProvider;
	model?: string;
	error?: string;
	streaming?: boolean;
	usage?: { inputTokens: number | null; outputTokens: number | null };
}

interface ChatState {
	messages: ChatMessage[];
	/** Request id of the reply being streamed, if any. */
	activeRequest: string | null;
	/** Context chips waiting to go out with the next message. */
	attached: AiContext[];
	attach: (item: AiContext) => void;
	detach: (index: number) => void;
	send: (text: string, provider: AiProvider, model: string) => void;
	stop: () => void;
	clear: () => void;
	onDelta: (requestId: string, text: string) => void;
	onDone: (requestId: string, usage: ChatMessage['usage'], cancelled: boolean) => void;
	onError: (requestId: string, message: string) => void;
}

// Keep the context window sane: long chats send only the most recent turns.
const HISTORY = 30;

export const useChat = create<ChatState>((set, get) => ({
	messages: [],
	activeRequest: null,
	attached: [],
	attach: (item) =>
		set((s) => ({
			// One item per kind+label: re-attaching the same file refreshes it.
			attached: [
				...s.attached.filter((a) => !(a.kind === item.kind && a.label === item.label)),
				item,
			],
		})),
	detach: (index) => set((s) => ({ attached: s.attached.filter((_, i) => i !== index) })),
	send: (text, provider, model) => {
		if (get().activeRequest || !text.trim()) return;
		const requestId = crypto.randomUUID();
		const context = get().attached;
		const user: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: text, context };
		const reply: ChatMessage = {
			id: requestId,
			role: 'assistant',
			content: '',
			provider,
			model,
			streaming: true,
		};
		const history = [...get().messages, user]
			.filter((m) => !m.error && m.content)
			.slice(-HISTORY)
			.map((m) => ({ role: m.role, content: m.content }));
		set((s) => ({
			messages: [...s.messages, user, reply],
			activeRequest: requestId,
			attached: [],
		}));
		call('ai:send', { requestId, provider, model, messages: history, context }).catch(
			(error: unknown) =>
				get().onError(requestId, error instanceof Error ? error.message : String(error)),
		);
	},
	stop: () => {
		const id = get().activeRequest;
		if (id) void call('ai:cancel', id).catch(() => undefined);
	},
	clear: () => {
		get().stop();
		set({ messages: [], activeRequest: null, attached: [] });
	},
	onDelta: (requestId, text) =>
		set((s) => ({
			messages: s.messages.map((m) =>
				m.id === requestId ? { ...m, content: m.content + text } : m,
			),
		})),
	onDone: (requestId, usage, cancelled) =>
		set((s) => ({
			activeRequest: s.activeRequest === requestId ? null : s.activeRequest,
			messages: s.messages.map((m) =>
				m.id === requestId
					? {
							...m,
							streaming: false,
							usage,
							...(cancelled && !m.content ? { error: 'Stopped' } : {}),
						}
					: m,
			),
		})),
	onError: (requestId, message) =>
		set((s) => ({
			activeRequest: s.activeRequest === requestId ? null : s.activeRequest,
			messages: s.messages.map((m) =>
				m.id === requestId ? { ...m, streaming: false, error: message } : m,
			),
		})),
}));
