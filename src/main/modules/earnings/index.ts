import { z } from 'zod';

import {
	type EarningsRange,
	EarningsSettingsSchema,
	EarningsSourceSchema,
} from '@shared/ipc/channels/earnings';
import { manifest } from '@shared/modules/earnings.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';

/** The sidecar's JSON (snake_case), validated before it crosses into Forge. */
const SidecarRangeSchema = z.object({
	source: EarningsSourceSchema,
	start: z.string(),
	end: z.string(),
	events: z.array(
		z.object({
			id: z.string(),
			date: z.string(),
			session: z.enum(['premarket', 'intraday', 'afterhours', 'unspecified']),
			symbol: z.string(),
			name: z.string().nullable(),
			impact: z.enum(['high', 'medium', 'low']),
			market_cap: z.number().nullable(),
			eps_forecast: z.string().nullable(),
			eps_actual: z.string().nullable(),
			eps_previous: z.string().nullable(),
			source: EarningsSourceSchema,
		}),
	),
	fetched_at: z.number(),
	stale: z.boolean(),
	failed_dates: z.array(z.string()),
	index_filter: z.enum(['on', 'off', 'unavailable', 'source']),
});

const DEFAULTS = { source: 'nasdaq', marketCalendarUrl: '', indexOnly: true } as const;

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const read = (): z.infer<typeof EarningsSettingsSchema> =>
			ctx.settings.get('config', EarningsSettingsSchema, DEFAULTS);
		const withKey = (s: z.infer<typeof EarningsSettingsSchema>) => ({
			...s,
			hasFinnhubKey: Boolean(ctx.getSecret('finnhub.key')),
		});

		ctx.ipc.handle('earnings:settings', () => withKey(read()));
		ctx.ipc.handle('earnings:setSettings', (next) =>
			withKey(ctx.settings.set('config', EarningsSettingsSchema, next)),
		);

		ctx.ipc.handle('earnings:range', async ({ start, end }): Promise<EarningsRange> => {
			const s = read();
			const headers: Record<string, string> = {};
			if (s.source === 'finnhub') {
				const key = ctx.getSecret('finnhub.key');
				if (key) headers['X-Finnhub-Token'] = key;
			}
			if (s.source === 'market-calendar' && s.marketCalendarUrl) {
				headers['X-Market-Calendar-Url'] = s.marketCalendarUrl;
			}
			const query = new URLSearchParams({
				start,
				end,
				source: s.source,
				index_only: String(s.indexOnly),
			});
			const parsed = SidecarRangeSchema.safeParse(
				await ctx.sidecar('GET', `/earnings/range?${query}`, undefined, headers),
			);
			if (!parsed.success) {
				ctx.log.error('unexpected earnings payload', { issues: parsed.error.message });
				throw new ForgeError(
					'EARNINGS_BAD_DATA',
					'The earnings service returned unexpected data',
				);
			}
			const r = parsed.data;
			return {
				source: r.source,
				start: r.start,
				end: r.end,
				events: r.events.map((e) => ({
					id: e.id,
					date: e.date,
					session: e.session,
					symbol: e.symbol,
					name: e.name,
					impact: e.impact,
					marketCap: e.market_cap,
					epsForecast: e.eps_forecast,
					epsActual: e.eps_actual,
					epsPrevious: e.eps_previous,
					source: e.source,
				})),
				fetchedAt: r.fetched_at * 1000,
				stale: r.stale,
				failedDates: r.failed_dates,
				indexFilter: r.index_filter,
			};
		});
	},
};
