import { z } from 'zod';

import { defineChannels } from '../define';

export const Mt5AccountSchema = z.object({
	login: z.number().int(),
	name: z.string(),
	server: z.string(),
	company: z.string(),
	currency: z.string(),
	mode: z.string(),
	leverage: z.number().int(),
	balance: z.number(),
	equity: z.number(),
	profit: z.number(),
	margin: z.number(),
	marginFree: z.number(),
	marginLevel: z.number().nullable(),
});
export type Mt5Account = z.infer<typeof Mt5AccountSchema>;

export const Mt5StatusSchema = z.object({
	available: z.boolean(),
	connected: z.boolean(),
	reason: z.string().nullable(),
	account: Mt5AccountSchema.nullable(),
});
export type Mt5Status = z.infer<typeof Mt5StatusSchema>;

export const Mt5PositionSchema = z.object({
	ticket: z.number().int(),
	symbol: z.string(),
	side: z.string(),
	volume: z.number(),
	priceOpen: z.number(),
	priceCurrent: z.number(),
	sl: z.number().nullable(),
	tp: z.number().nullable(),
	profit: z.number(),
	swap: z.number(),
	/** Epoch ms (broker server time as MT5 reports it). */
	openedAt: z.number(),
	comment: z.string(),
});
export type Mt5Position = z.infer<typeof Mt5PositionSchema>;

export const Mt5DealSchema = z.object({
	ticket: z.number().int(),
	position: z.number().int(),
	symbol: z.string(),
	side: z.string(),
	entry: z.string(),
	volume: z.number(),
	price: z.number(),
	profit: z.number(),
	commission: z.number(),
	swap: z.number(),
	time: z.number(),
	comment: z.string(),
});
export type Mt5Deal = z.infer<typeof Mt5DealSchema>;

/** Read-only by design: there is no channel that can place, modify or close orders. */
export const mt5Channels = defineChannels({
	'mt5:status': { input: z.void(), output: Mt5StatusSchema },
	'mt5:positions': { input: z.void(), output: z.array(Mt5PositionSchema) },
	'mt5:history': {
		input: z.object({ days: z.number().int().min(1).max(365) }),
		output: z.array(Mt5DealSchema),
	},
});
