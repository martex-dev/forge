import { z } from 'zod';

import { ImpactSchema } from '@shared/ipc/channels/calendar';
import { manifest } from '@shared/modules/calendar.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';

/** The sidecar's JSON (snake_case, ISO dates), validated before it crosses into Forge. */
const SidecarWeekSchema = z.object({
	source: z.literal('forexfactory'),
	fetched_at: z.string(),
	stale: z.boolean(),
	events: z.array(
		z.object({
			id: z.string(),
			title: z.string(),
			currency: z.string(),
			time: z.string(),
			impact: ImpactSchema,
			forecast: z.string().nullable(),
			previous: z.string().nullable(),
		}),
	),
});

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		ctx.ipc.handle('calendar:week', async () => {
			const parsed = SidecarWeekSchema.safeParse(await ctx.sidecar('GET', '/calendar/week'));
			if (!parsed.success) {
				ctx.log.error('unexpected calendar payload', { issues: parsed.error.message });
				throw new ForgeError(
					'CALENDAR_BAD_DATA',
					'The calendar service returned unexpected data',
				);
			}
			const week = parsed.data;
			return {
				source: week.source,
				stale: week.stale,
				fetchedAt: Date.parse(week.fetched_at),
				events: week.events.map((e) => ({ ...e, time: Date.parse(e.time) })),
			};
		});
	},
};
