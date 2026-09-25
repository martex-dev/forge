import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'mt5',
	name: 'MetaTrader 5',
	description:
		'Read-only view of the MT5 terminal: account, open positions with live P/L, deal history. Never places orders.',
	room: 'trade',
	platforms: ['win32'],
	defaultEnabled: true,
});
