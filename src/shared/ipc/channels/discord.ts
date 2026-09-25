import { z } from 'zod';

import { NotificationLevelSchema } from '../../notifications';
import { defineChannels } from '../define';

/** discord.com (and its ptb/canary subdomains, or the old discordapp.com) webhook URLs only. */
export const WebhookUrlSchema = z
	.string()
	.trim()
	.regex(
		/^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com\/api\/(?:v\d+\/)?webhooks\/\d+\/[\w-]+$/,
		'Paste a Discord webhook URL (Channel settings → Integrations → Webhooks → Copy URL)',
	);

export const ForwardRuleSchema = z.object({
	enabled: z.boolean(),
	levels: z.array(NotificationLevelSchema),
	/** Module ids to forward from; empty = all modules. */
	modules: z.array(z.string().max(50)).max(50),
});
export type ForwardRule = z.infer<typeof ForwardRuleSchema>;

/** A webhook as the renderer sees it: never the URL, which contains the token. */
export const WebhookInfoSchema = z.object({
	id: z.string(),
	name: z.string(),
	/** From Discord: the webhook's own name and where it posts. */
	webhookName: z.string().nullable(),
	channelId: z.string().nullable(),
	forward: ForwardRuleSchema,
	/** Last forwarding error, cleared by the next success. */
	lastError: z.string().nullable(),
});
export type WebhookInfo = z.infer<typeof WebhookInfoSchema>;

const Id = z.string().regex(/^[a-z0-9]{6,32}$/);
const List = z.array(WebhookInfoSchema);

export const discordChannels = defineChannels({
	'discord:list': { input: z.void(), output: List },
	/** Checks the URL with Discord before saving it (as a secret, in main). */
	'discord:add': {
		input: z.object({ name: z.string().trim().min(1).max(60), url: WebhookUrlSchema }),
		output: List,
	},
	'discord:update': {
		input: z.object({
			id: Id,
			name: z.string().trim().min(1).max(60).optional(),
			forward: ForwardRuleSchema.optional(),
		}),
		output: List,
	},
	'discord:remove': { input: Id, output: List },
	/** Posts Markdown text as "Forge". Discord caps a message at 2000 characters. */
	'discord:send': {
		input: z.object({ id: Id, content: z.string().trim().min(1).max(2000) }),
		output: z.void(),
	},
});
