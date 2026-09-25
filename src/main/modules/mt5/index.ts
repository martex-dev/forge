import { z } from 'zod';

import type { Mt5Deal, Mt5Position, Mt5Status } from '@shared/ipc/channels/mt5';
import { manifest } from '@shared/modules/mt5.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule, MainModuleContext } from '../../core/modules/types';

// The sidecar's snake_case shapes, validated at the boundary.
const Account = z.object({
	login: z.number(),
	name: z.string(),
	server: z.string(),
	company: z.string(),
	currency: z.string(),
	mode: z.string(),
	leverage: z.number(),
	balance: z.number(),
	equity: z.number(),
	profit: z.number(),
	margin: z.number(),
	margin_free: z.number(),
	margin_level: z.number().nullable(),
});
const Status = z.object({
	available: z.boolean(),
	connected: z.boolean(),
	reason: z.string().nullable(),
	account: Account.nullable(),
});
const Position = z.object({
	ticket: z.number(),
	symbol: z.string(),
	side: z.string(),
	volume: z.number(),
	price_open: z.number(),
	price_current: z.number(),
	sl: z.number().nullable(),
	tp: z.number().nullable(),
	profit: z.number(),
	swap: z.number(),
	opened_at: z.number(),
	comment: z.string(),
});
const Deal = z.object({
	ticket: z.number(),
	position: z.number(),
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

async function get<S extends z.ZodType>(
	ctx: MainModuleContext,
	path: string,
	schema: S,
): Promise<z.output<S>> {
	const parsed = schema.safeParse(await ctx.sidecar('GET', path));
	if (!parsed.success) {
		ctx.log.error('unexpected MT5 payload', { path, issues: parsed.error.message });
		throw new ForgeError('MT5_BAD_DATA', 'The MT5 service returned unexpected data');
	}
	return parsed.data;
}

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		ctx.ipc.handle('mt5:status', async (): Promise<Mt5Status> => {
			const s = await get(ctx, '/mt5/status', Status);
			const a = s.account;
			return {
				available: s.available,
				connected: s.connected,
				reason: s.reason,
				account: a
					? { ...a, marginFree: a.margin_free, marginLevel: a.margin_level }
					: null,
			};
		});
		ctx.ipc.handle('mt5:positions', async (): Promise<Mt5Position[]> =>
			(await get(ctx, '/mt5/positions', z.array(Position))).map((p) => ({
				ticket: p.ticket,
				symbol: p.symbol,
				side: p.side,
				volume: p.volume,
				priceOpen: p.price_open,
				priceCurrent: p.price_current,
				sl: p.sl,
				tp: p.tp,
				profit: p.profit,
				swap: p.swap,
				openedAt: p.opened_at * 1000,
				comment: p.comment,
			})),
		);
		ctx.ipc.handle('mt5:history', async ({ days }): Promise<Mt5Deal[]> =>
			(await get(ctx, `/mt5/history?days=${days}`, z.array(Deal))).map((d) => ({
				...d,
				time: d.time * 1000,
			})),
		);
	},
};
