import { z } from 'zod';

import { defineChannels } from '../define';

const Id = z.string().uuid();
const Num = z.number().finite().nullable();

export const JournalEntrySchema = z.object({
	id: Id,
	symbol: z.string().trim().min(1).max(40),
	market: z.enum(['crypto', 'forex', 'stocks', 'futures', 'other']),
	side: z.enum(['long', 'short']),
	/** idea = planned, not taken. */
	status: z.enum(['idea', 'open', 'closed']),
	entry: Num,
	exit: Num,
	size: Num,
	stop: Num,
	target: Num,
	/** Realised P/L in account currency. Null = derive from prices × size when possible. */
	pnl: Num,
	fees: z.number().finite(),
	/** Epoch ms. */
	openedAt: z.number().nullable(),
	closedAt: z.number().nullable(),
	setup: z.string().max(100),
	tags: z.array(z.string().trim().min(1).max(30)).max(20),
	/** Markdown. */
	notes: z.string().max(100_000),
	/** Screenshot file names stored with the entry. */
	images: z.array(z.string().regex(/^[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$/)).max(30),
	createdAt: z.number(),
	updatedAt: z.number(),
});
export type JournalEntry = z.infer<typeof JournalEntrySchema>;

const ImageFile = z.string().regex(/^[0-9a-f-]{36}\.(png|jpg|jpeg|webp)$/);

export const journalChannels = defineChannels({
	'journal:list': { input: z.void(), output: z.array(JournalEntrySchema) },
	/** Create or replace by id (images are managed by the image channels, not here). */
	'journal:save': { input: JournalEntrySchema, output: JournalEntrySchema },
	'journal:delete': { input: Id, output: z.void() },
	/** Pasted screenshot (base64 without the data: prefix). */
	'journal:addImage': {
		input: z.object({
			entryId: Id,
			mime: z.enum(['image/png', 'image/jpeg', 'image/webp']),
			base64: z.string().max(14_000_000),
		}),
		output: JournalEntrySchema,
	},
	/** Native file picker for images; unchanged entry if cancelled. */
	'journal:pickImages': { input: Id, output: JournalEntrySchema },
	'journal:image': { input: z.object({ entryId: Id, file: ImageFile }), output: z.string() },
	'journal:removeImage': {
		input: z.object({ entryId: Id, file: ImageFile }),
		output: JournalEntrySchema,
	},
});
