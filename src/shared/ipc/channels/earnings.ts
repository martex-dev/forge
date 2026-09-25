import { z } from 'zod';

import { defineChannels } from '../define';

export const EarningsSourceSchema = z.enum(['nasdaq', 'finnhub', 'market-calendar']);
export type EarningsSource = z.infer<typeof EarningsSourceSchema>;

export const EarningsSessionSchema = z.enum(['premarket', 'intraday', 'afterhours', 'unspecified']);
export type EarningsSession = z.infer<typeof EarningsSessionSchema>;

const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const EarningsEventSchema = z.object({
	id: z.string(),
	/** US Eastern calendar date; `session` says when in the day. */
	date: IsoDate,
	session: EarningsSessionSchema,
	symbol: z.string(),
	name: z.string().nullable(),
	impact: z.enum(['high', 'medium', 'low']),
	marketCap: z.number().nullable(),
	epsForecast: z.string().nullable(),
	epsActual: z.string().nullable(),
	epsPrevious: z.string().nullable(),
	source: EarningsSourceSchema,
});
export type EarningsEvent = z.infer<typeof EarningsEventSchema>;

export const EarningsRangeSchema = z.object({
	source: EarningsSourceSchema,
	start: IsoDate,
	end: IsoDate,
	events: z.array(EarningsEventSchema),
	fetchedAt: z.number(),
	/** An upstream refresh failed; some days are the last good copy. */
	stale: z.boolean(),
	/** Days NASDAQ couldn't deliver at all. */
	failedDates: z.array(IsoDate),
	/** 'unavailable': index lists couldn't load, so nothing was filtered. 'source': it filters itself. */
	indexFilter: z.enum(['on', 'off', 'unavailable', 'source']),
});
export type EarningsRange = z.infer<typeof EarningsRangeSchema>;

export const MarketCalendarUrlSchema = z
	.string()
	.trim()
	.max(300)
	.refine(
		(v) =>
			v === '' ||
			/^https:\/\/[^\s]+$/.test(v) ||
			/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/\S*)?$/.test(v),
		'Use an https:// URL (http://localhost for a dev server)',
	);

export const EarningsSettingsSchema = z.object({
	source: EarningsSourceSchema,
	/** Base URL of Marto's Market Calendar deployment. */
	marketCalendarUrl: MarketCalendarUrlSchema,
	/** Only S&P 500 and Nasdaq-100 companies. */
	indexOnly: z.boolean(),
});
export type EarningsSettings = z.infer<typeof EarningsSettingsSchema>;

export const earningsChannels = defineChannels({
	'earnings:range': {
		input: z.object({ start: IsoDate, end: IsoDate }),
		output: EarningsRangeSchema,
	},
	'earnings:settings': {
		input: z.void(),
		output: EarningsSettingsSchema.extend({ hasFinnhubKey: z.boolean() }),
	},
	'earnings:setSettings': {
		input: EarningsSettingsSchema,
		output: EarningsSettingsSchema.extend({ hasFinnhubKey: z.boolean() }),
	},
});
