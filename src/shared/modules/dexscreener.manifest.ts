import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'dexscreener',
	name: 'DexScreener',
	description:
		'Watchlist of DEX pairs (Solana, Base, ETH…) with live price, liquidity and volume.',
	room: 'trade',
	defaultEnabled: true,
});
