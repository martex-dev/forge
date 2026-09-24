import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'tradingview',
	name: 'TradingView',
	description:
		'TradingView charts in an isolated, persistent webview (log in once, stays logged in).',
	room: 'trade',
	defaultEnabled: true,
});
