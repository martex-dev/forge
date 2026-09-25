import { randomBytes } from 'node:crypto';

import { z } from 'zod';

import {
	ForwardRuleSchema,
	type WebhookInfo,
	WebhookInfoSchema,
} from '@shared/ipc/channels/discord';
import { manifest } from '@shared/modules/discord.manifest';
import type { ForgeNotification } from '@shared/notifications';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';
import { DiscordPoster, fetchMeta, notificationPayload, textPayload } from './discord-client';

const SECRET = 'discord.webhooks';
const HooksSchema = z.array(WebhookInfoSchema.omit({ lastError: true })).max(20);
const UrlsSchema = z.record(z.string(), z.string());

export const DEFAULT_RULE = ForwardRuleSchema.parse({
	enabled: false,
	levels: ['warn', 'error'],
	modules: [],
});

export function shouldForward(
	rule: z.infer<typeof ForwardRuleSchema>,
	n: ForgeNotification,
): boolean {
	// Never forward Discord's own notices: a failing webhook would report itself forever.
	if (!rule.enabled || n.module === 'discord') return false;
	return (
		rule.levels.includes(n.level) &&
		(rule.modules.length === 0 || rule.modules.includes(n.module))
	);
}

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const poster = new DiscordPoster();
		const errors = new Map<string, string>();
		const hooks = (): Array<Omit<WebhookInfo, 'lastError'>> =>
			ctx.settings.get('hooks', HooksSchema, []);
		const saveHooks = (list: Array<Omit<WebhookInfo, 'lastError'>>): void => {
			ctx.settings.set('hooks', HooksSchema, list);
		};
		// All webhook URLs live in one declared secret, as JSON: they embed the webhook token.
		const urls = (): Record<string, string> => {
			const raw = ctx.getSecret(SECRET);
			if (!raw) return {};
			const parsed = UrlsSchema.safeParse(JSON.parse(raw));
			return parsed.success ? parsed.data : {};
		};
		const saveUrls = (map: Record<string, string>): void =>
			ctx.setSecret(SECRET, Object.keys(map).length ? JSON.stringify(map) : null);
		const list = (): WebhookInfo[] =>
			hooks().map((h) => ({ ...h, lastError: errors.get(h.id) ?? null }));
		const urlFor = (id: string): string => {
			const url = urls()[id];
			if (!url) throw new ForgeError('DISCORD_UNKNOWN', 'That webhook is gone; add it again');
			return url;
		};

		ctx.ipc.handle('discord:list', list);
		ctx.ipc.handle('discord:add', async ({ name, url }) => {
			const current = hooks();
			if (current.length >= 20) throw new ForgeError('DISCORD_TOO_MANY', 'Up to 20 webhooks');
			const meta = await fetchMeta(url); // proves the URL works before storing it
			const id = randomBytes(6).toString('hex');
			saveUrls({ ...urls(), [id]: url });
			saveHooks([
				...current,
				{
					id,
					name,
					webhookName: meta.name,
					channelId: meta.channelId,
					forward: DEFAULT_RULE,
				},
			]);
			return list();
		});
		ctx.ipc.handle('discord:update', ({ id, name, forward }) => {
			saveHooks(
				hooks().map((h) =>
					h.id === id
						? { ...h, ...(name ? { name } : {}), ...(forward ? { forward } : {}) }
						: h,
				),
			);
			return list();
		});
		ctx.ipc.handle('discord:remove', (id) => {
			const { [id]: _gone, ...rest } = urls();
			saveUrls(rest);
			saveHooks(hooks().filter((h) => h.id !== id));
			errors.delete(id);
			return list();
		});
		ctx.ipc.handle('discord:send', async ({ id, content }) => {
			await poster.post(id, urlFor(id), textPayload(content));
		});

		ctx.onNotification((n) => {
			const map = urls();
			for (const hook of hooks()) {
				const url = map[hook.id];
				if (!url || !shouldForward(hook.forward, n)) continue;
				poster
					.post(hook.id, url, notificationPayload(n))
					.then(() => errors.delete(hook.id))
					.catch((error: unknown) => {
						const message = error instanceof Error ? error.message : String(error);
						errors.set(hook.id, message);
						ctx.log.warn('discord forward failed', { hook: hook.name, error: message });
					});
			}
		});
	},
};
