import { z } from 'zod';

import {
	type Alert,
	AlertSchema,
	type AlertState,
	type PriceAlert,
	type PriceSource,
} from '@shared/ipc/channels/alerts';
import { manifest } from '@shared/modules/alerts.manifest';

import type { MainModule, MainModuleContext } from '../../core/modules/types';
import { crossed, describeSource, dueEvents, firedKey, formatValue } from './evaluate';

const RulesSchema = z.array(AlertSchema).max(200);
const FiredSchema = z.array(z.object({ key: z.string(), at: z.number() })).max(5_000);
const TICK_MS = 15_000;
const FIRED_TTL = 8 * 86_400_000; // calendar weeks roll over; forget old announcements

const Candles = z.object({ candles: z.array(z.object({ close: z.number() })) });
const Pairs = z.array(
	z.object({ chain_id: z.string(), pair_address: z.string(), price_usd: z.number().nullable() }),
);
const Week = z.object({
	events: z.array(
		z.object({
			id: z.string(),
			title: z.string(),
			currency: z.string(),
			time: z.string(),
			impact: z.string(),
			forecast: z.string().nullable(),
			previous: z.string().nullable(),
		}),
	),
});

const dexKey = (chainId: string, pair: string): string => `${chainId}:${pair.toLowerCase()}`;

async function binancePrice(ctx: MainModuleContext, symbol: string): Promise<number | null> {
	const raw = Candles.parse(
		await ctx.sidecar('GET', `/chart/binance?symbol=${symbol}&interval=1m&limit=10`),
	);
	return raw.candles.at(-1)?.close ?? null;
}

async function dexPrices(ctx: MainModuleContext, ids: string[]): Promise<Map<string, number>> {
	if (ids.length === 0) return new Map();
	const raw = Pairs.parse(
		await ctx.sidecar('GET', `/dex/pairs?ids=${encodeURIComponent(ids.join(','))}`),
	);
	return new Map(
		raw.flatMap((p) =>
			p.price_usd === null ? [] : [[dexKey(p.chain_id, p.pair_address), p.price_usd]],
		),
	);
}

function chartTarget(source: PriceSource): { panelId: string; params: Record<string, unknown> } {
	return source.kind === 'binance'
		? { panelId: 'chart.main', params: { source: { kind: 'binance', symbol: source.symbol } } }
		: {
				panelId: 'chart.main',
				params: {
					source: {
						kind: 'pool',
						chainId: source.chainId,
						pairAddress: source.pairAddress,
					},
					label: source.label,
				},
			};
}

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const read = (): Alert[] => ctx.settings.get('rules', RulesSchema, []);
		const write = (rules: Alert[]): Alert[] => {
			const saved = ctx.settings.set('rules', RulesSchema, rules);
			ctx.emit('alerts:changed', saved);
			return saved;
		};
		const previous = new Map<string, number>();
		const state = new Map<string, AlertState>();

		const fetchPrice = async (source: PriceSource): Promise<number | null> =>
			source.kind === 'binance'
				? binancePrice(ctx, source.symbol)
				: ((await dexPrices(ctx, [dexKey(source.chainId, source.pairAddress)])).get(
						dexKey(source.chainId, source.pairAddress),
					) ?? null);

		const checkPrices = async (rules: PriceAlert[]): Promise<Alert[]> => {
			const fired: string[] = [];
			const dexIds = [
				...new Set(
					rules.flatMap((r) =>
						r.source.kind === 'dex'
							? [dexKey(r.source.chainId, r.source.pairAddress)]
							: [],
					),
				),
			];
			const dex = await dexPrices(ctx, dexIds).catch((error: unknown) => {
				for (const r of rules)
					if (r.source.kind === 'dex')
						state.set(r.id, {
							id: r.id,
							price: null,
							checkedAt: Date.now(),
							error: String(error),
						});
				return new Map<string, number>();
			});
			const binance = new Map<string, number | null>();
			for (const rule of rules) {
				let price: number | null = null;
				try {
					if (rule.source.kind === 'dex') {
						price =
							dex.get(dexKey(rule.source.chainId, rule.source.pairAddress)) ?? null;
					} else {
						if (!binance.has(rule.source.symbol))
							binance.set(
								rule.source.symbol,
								await binancePrice(ctx, rule.source.symbol),
							);
						price = binance.get(rule.source.symbol) ?? null;
					}
				} catch (error) {
					state.set(rule.id, {
						id: rule.id,
						price: null,
						checkedAt: Date.now(),
						error: error instanceof Error ? error.message : String(error),
					});
					continue;
				}
				if (price === null) continue;
				state.set(rule.id, { id: rule.id, price, checkedAt: Date.now(), error: null });
				if (crossed(rule, previous.get(rule.id) ?? null, price)) {
					fired.push(rule.id);
					const name = describeSource(rule);
					ctx.notify({
						level: 'warn',
						title: `${name} crossed ${rule.op} ${formatValue(rule.value)}`,
						body: `Now ${formatValue(price)}${rule.note ? ` · ${rule.note}` : ''}`,
						target: chartTarget(rule.source),
					});
				}
				previous.set(rule.id, price);
			}
			if (fired.length === 0) return read();
			const now = Date.now();
			return write(
				read().map((r) =>
					fired.includes(r.id)
						? {
								...r,
								lastFiredAt: now,
								enabled:
									r.kind === 'price' && r.repeat === 'once' ? false : r.enabled,
							}
						: r,
				),
			);
		};

		const checkCalendar = async (rules: Alert[]): Promise<void> => {
			const calendarRules = rules.flatMap((r) =>
				r.kind === 'calendar' && r.enabled ? [r] : [],
			);
			if (calendarRules.length === 0) return;
			const week = Week.parse(await ctx.sidecar('GET', '/calendar/week'));
			const events = week.events.map((e) => ({ ...e, time: Date.parse(e.time) }));
			const now = Date.now();
			const firedList = ctx.settings
				.get('firedCalendar', FiredSchema, [])
				.filter((f) => now - f.at < FIRED_TTL);
			const fired = new Set(firedList.map((f) => f.key));
			for (const rule of calendarRules) {
				for (const event of dueEvents(rule, events, now, fired)) {
					const minutes = Math.max(1, Math.round((event.time - now) / 60_000));
					ctx.notify({
						level: 'warn',
						title: `${event.currency} ${event.title} in ${minutes} min`,
						body: [
							event.forecast && `forecast ${event.forecast}`,
							event.previous && `previous ${event.previous}`,
						]
							.filter(Boolean)
							.join(' · '),
						target: { panelId: 'calendar.week' },
					});
					firedList.push({ key: firedKey(rule.id, event.id), at: now });
					fired.add(firedKey(rule.id, event.id));
				}
			}
			ctx.settings.set('firedCalendar', FiredSchema, firedList.slice(-5_000));
		};

		let running = false;
		const tick = async (): Promise<void> => {
			const rules = read().filter((r) => r.enabled);
			if (running || rules.length === 0) return;
			running = true;
			try {
				await checkPrices(rules.flatMap((r) => (r.kind === 'price' ? [r] : [])));
				await checkCalendar(rules);
			} catch (error) {
				// Sidecar restarting or offline: try again next tick.
				ctx.log.warn('alert check failed', { error: String(error) });
			} finally {
				running = false;
			}
		};
		const timer = setInterval(() => void tick(), TICK_MS);
		ctx.onDispose(() => clearInterval(timer));

		ctx.ipc.handle('alerts:list', () => read());
		ctx.ipc.handle('alerts:save', (alert) => {
			// A changed threshold starts fresh: wait for the next cross from the current price.
			previous.delete(alert.id);
			const rules = read();
			const exists = rules.some((r) => r.id === alert.id);
			return write(
				exists ? rules.map((r) => (r.id === alert.id ? alert : r)) : [...rules, alert],
			);
		});
		ctx.ipc.handle('alerts:delete', (id) => {
			previous.delete(id);
			state.delete(id);
			return write(read().filter((r) => r.id !== id));
		});
		ctx.ipc.handle('alerts:state', () => [...state.values()]);
		ctx.ipc.handle('alerts:price', (source) => fetchPrice(source));
	},
};
