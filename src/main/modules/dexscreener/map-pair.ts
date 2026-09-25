import { z } from 'zod';

import type { DexPair } from '@shared/ipc/channels/dex';

const Windowed = z.object({
	m5: z.number().nullable(),
	h1: z.number().nullable(),
	h6: z.number().nullable(),
	h24: z.number().nullable(),
});
const Txns = z.object({ buys: z.number().int(), sells: z.number().int() });
const TokenRef = z.object({ address: z.string(), name: z.string(), symbol: z.string() });

/** The sidecar's snake_case shape, validated at the process boundary. */
export const SidecarPairSchema = z.object({
	chain_id: z.string(),
	dex_id: z.string(),
	pair_address: z.string(),
	url: z.string(),
	base: TokenRef,
	quote: TokenRef,
	price_usd: z.number().nullable(),
	price_native: z.number().nullable(),
	change: Windowed,
	volume: Windowed,
	txns_h24: Txns,
	txns_h1: Txns,
	liquidity_usd: z.number().nullable(),
	fdv: z.number().nullable(),
	market_cap: z.number().nullable(),
	created_at: z.number().nullable(),
	image_url: z.string().nullable(),
	links: z.array(z.object({ label: z.string(), url: z.string() })),
});

export function toDexPair(p: z.infer<typeof SidecarPairSchema>): DexPair {
	return {
		chainId: p.chain_id,
		dexId: p.dex_id,
		pairAddress: p.pair_address,
		url: p.url,
		base: p.base,
		quote: p.quote,
		priceUsd: p.price_usd,
		priceNative: p.price_native,
		change: p.change,
		volume: p.volume,
		txnsH24: p.txns_h24,
		txnsH1: p.txns_h1,
		liquidityUsd: p.liquidity_usd,
		fdv: p.fdv,
		marketCap: p.market_cap,
		createdAt: p.created_at,
		// Only DexScreener's own image CDN; anything else is dropped rather than loaded.
		imageUrl: p.image_url?.startsWith('https://') ? p.image_url : null,
		links: p.links.filter((l) => l.url.startsWith('https://')),
	};
}

export function parsePairs(raw: unknown): DexPair[] {
	return z.array(SidecarPairSchema).parse(raw).map(toDexPair);
}
