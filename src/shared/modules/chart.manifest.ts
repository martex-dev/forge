import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'chart',
	name: 'Charts',
	description: 'Candlestick charts: Binance spot markets and DEX pools (via GeckoTerminal).',
	room: 'trade',
	defaultEnabled: true,
});
