import { describe, expect, it } from 'vitest';

import { parsePairs } from './map-pair';

const raw = {
	chain_id: 'solana',
	dex_id: 'raydium',
	pair_address: '8sLbNZoA1cfnvMJLPfp98ZLAnFSYCFApfJKMbiXNLwxj',
	url: 'https://dexscreener.com/solana/x',
	base: { address: 'mint', name: 'Bonk', symbol: 'BONK' },
	quote: { address: 'So11', name: 'Wrapped SOL', symbol: 'SOL' },
	price_usd: 0.0000213,
	price_native: 0.0000001,
	change: { m5: 1, h1: null, h6: null, h24: 25 },
	volume: { m5: 1, h1: 2, h6: 3, h24: 4 },
	txns_h24: { buys: 1, sells: 2 },
	txns_h1: { buys: 0, sells: 0 },
	liquidity_usd: 1e6,
	fdv: 5e6,
	market_cap: 4e6,
	created_at: 1_700_000_000_000,
	image_url: 'http://insecure.example/img.png',
	links: [{ label: 'Website', url: 'https://example.com' }],
};

describe('parsePairs', () => {
	it('maps snake_case sidecar pairs to camelCase and drops insecure images', () => {
		const [pair] = parsePairs([raw]);
		expect(pair).toMatchObject({
			chainId: 'solana',
			pairAddress: raw.pair_address,
			priceUsd: 0.0000213,
			liquidityUsd: 1e6,
			txnsH24: { buys: 1, sells: 2 },
			imageUrl: null,
		});
	});

	it('rejects malformed payloads instead of passing them on', () => {
		expect(() => parsePairs([{ ...raw, price_usd: 'free money' }])).toThrow();
		expect(() => parsePairs({ pairs: [] })).toThrow();
	});
});
