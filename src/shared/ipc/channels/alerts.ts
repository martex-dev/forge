import { z } from 'zod';

import { defineChannels } from '../define';
import { ImpactSchema } from './calendar';
import { BinanceSymbolSchema } from './chart';
import { PairIdSchema } from './dex';

export const PriceSourceSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('binance'), symbol: BinanceSymbolSchema }),
	PairIdSchema.extend({ kind: z.literal('dex'), label: z.string().max(40) }),
]);
export type PriceSource = z.infer<typeof PriceSourceSchema>;

const Base = z.object({
	id: z.string().uuid(),
	enabled: z.boolean(),
	createdAt: z.number(),
	lastFiredAt: z.number().nullable(),
});

export const PriceAlertSchema = Base.extend({
	kind: z.literal('price'),
	source: PriceSourceSchema,
	/** Fires when the price crosses the value in this direction. */
	op: z.enum(['above', 'below']),
	value: z.number().positive(),
	/** once: disable after firing. every: re-arm when the price crosses back. */
	repeat: z.enum(['once', 'every']),
	note: z.string().max(200),
});
export type PriceAlert = z.infer<typeof PriceAlertSchema>;

export const CalendarAlertSchema = Base.extend({
	kind: z.literal('calendar'),
	minutesBefore: z.number().int().min(1).max(240),
	impacts: z.array(ImpactSchema).min(1),
	/** Empty = every currency. */
	currencies: z.array(z.string().length(3)),
});
export type CalendarAlert = z.infer<typeof CalendarAlertSchema>;

export const AlertSchema = z.discriminatedUnion('kind', [PriceAlertSchema, CalendarAlertSchema]);
export type Alert = z.infer<typeof AlertSchema>;

export const AlertStateSchema = z.object({
	id: z.string(),
	/** Last price seen for price alerts. */
	price: z.number().nullable(),
	checkedAt: z.number().nullable(),
	error: z.string().nullable(),
});
export type AlertState = z.infer<typeof AlertStateSchema>;

export const alertChannels = defineChannels({
	'alerts:list': { input: z.void(), output: z.array(AlertSchema) },
	/** Create or replace (by id). */
	'alerts:save': { input: AlertSchema, output: z.array(AlertSchema) },
	'alerts:delete': { input: z.string().uuid(), output: z.array(AlertSchema) },
	'alerts:state': { input: z.void(), output: z.array(AlertStateSchema) },
	/** Current price for a source, to show next to the threshold while editing. */
	'alerts:price': { input: PriceSourceSchema, output: z.number().nullable() },
});

export const alertEvents = {
	'alerts:changed': z.array(AlertSchema),
};
