import { z } from 'zod';

import { defineChannels } from '../define';

/** Notion ids: 32 hex characters, with or without dashes. */
export const NotionIdSchema = z
	.string()
	.regex(/^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i);

export const NotionPageSummarySchema = z.object({
	id: NotionIdSchema,
	title: z.string(),
	icon: z.string().nullable(),
	url: z.string(),
	/** Epoch ms. */
	lastEdited: z.number(),
	parent: z.enum(['workspace', 'page', 'database', 'block']),
});
export type NotionPageSummary = z.infer<typeof NotionPageSummarySchema>;

export const NotionPageSchema = NotionPageSummarySchema.extend({
	markdown: z.string(),
	/** Stopped at the block limit; the rest is in Notion. */
	truncated: z.boolean(),
});
export type NotionPage = z.infer<typeof NotionPageSchema>;

export const notionChannels = defineChannels({
	'notion:status': { input: z.void(), output: z.object({ hasToken: z.boolean() }) },
	/** Pages shared with the integration; empty query = most recently edited. */
	'notion:search': {
		input: z.object({ query: z.string().max(200) }),
		output: z.array(NotionPageSummarySchema),
	},
	'notion:page': { input: NotionIdSchema, output: NotionPageSchema },
	'notion:append': {
		input: z.object({
			id: NotionIdSchema,
			kind: z.enum(['paragraph', 'to_do', 'bulleted_list_item']),
			text: z.string().trim().min(1).max(2000),
		}),
		output: z.void(),
	},
	'notion:create': {
		input: z.object({ parentId: NotionIdSchema, title: z.string().trim().min(1).max(200) }),
		output: NotionPageSummarySchema,
	},
});
