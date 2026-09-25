import { type AiProvider, type AiSettings, AiSettingsSchema } from '@shared/ipc/channels/ai';
import { manifest } from '@shared/modules/ai.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';
import { AiService, gitDiff } from './ai-service';
import { PROVIDER_SECRET } from './providers';

// Model ids are editable in the panel; these are sensible starting points per provider.
const DEFAULTS: AiSettings = {
	provider: 'anthropic',
	models: { anthropic: 'claude-opus-5-5', openai: 'gpt-5', gemini: 'gemini-2.5-pro' },
};

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const keyOf = (provider: AiProvider): string | null =>
			ctx.getSecret(PROVIDER_SECRET[provider]);
		// e2e only: a local mock that speaks each provider's streaming protocol.
		const mock = process.env['FORGE_E2E'] === '1' ? process.env['FORGE_AI_API'] : undefined;
		const ai = new AiService(keyOf, mock);
		ctx.onDispose(() => ai.cancelAll());

		ctx.ipc.handle('ai:settings', () =>
			ctx.settings.get('settings', AiSettingsSchema, DEFAULTS),
		);
		ctx.ipc.handle('ai:setSettings', (next) =>
			ctx.settings.set('settings', AiSettingsSchema, next),
		);
		ctx.ipc.handle('ai:keys', () => ({
			anthropic: Boolean(keyOf('anthropic')),
			openai: Boolean(keyOf('openai')),
			gemini: Boolean(keyOf('gemini')),
		}));
		ctx.ipc.handle('ai:send', ({ requestId, provider, model, messages, context }) => {
			// Fire and forget: the reply streams back as events, so the IPC call returns at once.
			void ai.stream(requestId, provider, model, messages, context, {
				delta: (text) => ctx.emit('ai:delta', { requestId, text }),
				done: (usage, cancelled) => ctx.emit('ai:done', { requestId, ...usage, cancelled }),
				error: (message) => {
					ctx.log.warn('ai request failed', { provider, model, message });
					ctx.emit('ai:error', { requestId, message });
				},
			});
		});
		ctx.ipc.handle('ai:cancel', (requestId) => ai.cancel(requestId));
		ctx.ipc.handle('ai:gitDiff', () => {
			const root = ctx.workspace.root();
			if (!root) throw new ForgeError('AI_NO_FOLDER', 'Open a folder to attach its git diff');
			return gitDiff(root);
		});
	},
};
