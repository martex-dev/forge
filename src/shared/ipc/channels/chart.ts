import { z } from 'zod';

import { defineChannels } from '../define';
import { PairIdSchema } from './dex';

export const INTERVALS = ['1m', '5m', '15m', '1h', '4h', '1d'] as const;
export const IntervalSchema = z.enum(INTERVALS);
export type Interval = z.infer<typeof IntervalSchema>;

export const BinanceSymbolSchema = z
	.string()
	.trim()
	.toUpperCase()
	.regex(/^[A-Z0-9]{5,20}$/, 'Use a Binance symbol like BTCUSDT');

/** Where candles come from: a Binance spot market, or a DEX pool via GeckoTerminal. */
export const ChartSourceSchema = z.discriminatedUnion('kind', [
	z.object({ kind: z.literal('binance'), symbol: BinanceSymbolSchema }),
	PairIdSchema.extend({ kind: z.literal('pool') }),
]);
export type ChartSource = z.infer<typeof ChartSourceSchema>;

export const CandleSchema = z.object({
	/** Bar open, unix seconds (UTC). */
	time: z.number().int(),
	open: z.number(),
	high: z.number(),
	low: z.number(),
	close: z.number(),
	/** Quote-currency volume (USDT on Binance, USD on GeckoTerminal). */
	volume: z.number(),
});
export type Candle = z.infer<typeof CandleSchema>;

export const CandleSeriesSchema = z.object({
	candles: z.array(CandleSchema),
	/** Upstream refresh failed; this is the last good copy. */
	stale: z.boolean(),
});
export type CandleSeries = z.infer<typeof CandleSeriesSchema>;

export const chartChannels = defineChannels({
	'chart:candles': {
		input: z.object({ source: ChartSourceSchema, interval: IntervalSchema }),
		output: CandleSeriesSchema,
	},
});
