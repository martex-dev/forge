import { z } from 'zod';

import { defineChannels } from '../define';

export const AiProviderSchema = z.enum(['anthropic', 'openai', 'gemini']);
export type AiProvider = z.infer<typeof AiProviderSchema>;

export const AiMessageSchema = z.object({
	role: z.enum(['user', 'assistant']),
	content: z.string().max(400_000),
});
export type AiMessage = z.infer<typeof AiMessageSchema>;

export const AiContextSchema = z.object({
	kind: z.enum(['file', 'selection', 'diff']),
	/** e.g. "src/app.py" or "git diff". */
	label: z.string().max(500),
	language: z.string().max(50).nullable(),
	text: z.string().max(400_000),
});
export type AiContext = z.infer<typeof AiContextSchema>;

export const AiSettingsSchema = z.object({
	provider: AiProviderSchema,
	models: z.record(AiProviderSchema, z.string().min(1).max(100)),
});
export type AiSettings = z.infer<typeof AiSettingsSchema>;

const RequestIdSchema = z.string().uuid();

export const aiChannels = defineChannels({
	'ai:settings': { input: z.void(), output: AiSettingsSchema },
	'ai:setSettings': { input: AiSettingsSchema, output: AiSettingsSchema },
	/** Which providers have an API key saved (keys themselves never leave main). */
	'ai:keys': { input: z.void(), output: z.record(AiProviderSchema, z.boolean()) },
	/** Starts a streamed reply; text arrives as `ai:delta` events for this request id. */
	'ai:send': {
		input: z.object({
			requestId: RequestIdSchema,
			provider: AiProviderSchema,
			model: z.string().min(1).max(100),
			messages: z.array(AiMessageSchema).min(1).max(100),
			context: z.array(AiContextSchema).max(10),
		}),
		output: z.void(),
	},
	'ai:cancel': { input: RequestIdSchema, output: z.void() },
	/** `git diff HEAD` of the open folder (capped), for attaching as context. */
	'ai:gitDiff': {
		input: z.void(),
		output: z.object({ diff: z.string(), truncated: z.boolean() }),
	},
});

export const aiEvents = {
	'ai:delta': z.object({ requestId: RequestIdSchema, text: z.string() }),
	'ai:done': z.object({
		requestId: RequestIdSchema,
		inputTokens: z.number().nullable(),
		outputTokens: z.number().nullable(),
		cancelled: z.boolean(),
	}),
	'ai:error': z.object({ requestId: RequestIdSchema, message: z.string() }),
};
