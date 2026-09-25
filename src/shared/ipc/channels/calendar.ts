import { z } from 'zod';

import { defineChannels } from '../define';

export const ImpactSchema = z.enum(['high', 'medium', 'low', 'holiday', 'none']);
export type Impact = z.infer<typeof ImpactSchema>;

export const CalendarEventSchema = z.object({
	id: z.string(),
	title: z.string(),
	/** ISO currency code the event moves (USD, EUR…). */
	currency: z.string(),
	/** Epoch milliseconds (UTC). */
	time: z.number(),
	impact: ImpactSchema,
	forecast: z.string().nullable(),
	previous: z.string().nullable(),
});
export type CalendarEvent = z.infer<typeof CalendarEventSchema>;

export const CalendarWeekSchema = z.object({
	source: z.literal('forexfactory'),
	events: z.array(CalendarEventSchema),
	fetchedAt: z.number(),
	/** Upstream refresh failed; this is the last good copy. */
	stale: z.boolean(),
});
export type CalendarWeek = z.infer<typeof CalendarWeekSchema>;

export const calendarChannels = defineChannels({
	'calendar:week': { input: z.void(), output: CalendarWeekSchema },
});
