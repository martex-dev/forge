import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'alerts',
	name: 'Alerts',
	description:
		'Price alerts (Binance symbols, DEX pairs) and "event in N minutes" calendar alerts, delivered to the inbox and Windows toasts.',
	room: 'trade',
	defaultEnabled: true,
});
