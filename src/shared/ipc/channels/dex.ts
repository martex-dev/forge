import { z } from 'zod';

import { defineChannels } from '../define';

const Windowed = z.object({
	m5: z.number().nullable(),
	h1: z.number().nullable(),
	h6: z.number().nullable(),
	h24: z.number().nullable(),
});
const Txns = z.object({ buys: z.number().int(), sells: z.number().int() });
const TokenRef = z.object({ address: z.string(), name: z.string(), symbol: z.string() });

export const DexPairSchema = z.object({
	chainId: z.string(),
	dexId: z.string(),
	pairAddress: z.string(),
	url: z.string(),
	base: TokenRef,
	quote: TokenRef,
	priceUsd: z.number().nullable(),
	priceNative: z.number().nullable(),
	change: Windowed,
	volume: Windowed,
	txnsH24: Txns,
	txnsH1: Txns,
	liquidityUsd: z.number().nullable(),
	fdv: z.number().nullable(),
	marketCap: z.number().nullable(),
	createdAt: z.number().nullable(),
	imageUrl: z.string().nullable(),
	links: z.array(z.object({ label: z.string(), url: z.string() })),
});
export type DexPair = z.infer<typeof DexPairSchema>;

export const PairIdSchema = z.object({
	chainId: z.string().regex(/^[a-z0-9-]{2,32}$/),
	// Base58 (Solana), 0x + 40 hex (EVM pairs) or 0x + 64 hex (v4-style pool ids).
	pairAddress: z.string().regex(/^[A-Za-z0-9]{20,100}$/),
});
export type PairId = z.infer<typeof PairIdSchema>;

export const WatchEntrySchema = PairIdSchema.extend({
	/** Shown until the first quote arrives. */
	symbol: z.string().max(40),
	addedAt: z.number(),
});
export type WatchEntry = z.infer<typeof WatchEntrySchema>;

export const dexChannels = defineChannels({
	'dex:watchlist': { input: z.void(), output: z.array(WatchEntrySchema) },
	'dex:watch': {
		input: PairIdSchema.extend({ symbol: z.string().max(40) }),
		output: z.array(WatchEntrySchema),
	},
	'dex:unwatch': { input: PairIdSchema, output: z.array(WatchEntrySchema) },
	/** Latest data for every watched pair (sidecar-cached ~10 s). */
	'dex:quotes': { input: z.void(), output: z.array(DexPairSchema) },
	'dex:pair': { input: PairIdSchema, output: DexPairSchema.nullable() },
	'dex:search': { input: z.string().trim().min(2).max(100), output: z.array(DexPairSchema) },
});

export const dexEvents = {
	'dex:watchlistChanged': z.array(WatchEntrySchema),
};
