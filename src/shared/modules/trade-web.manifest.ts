import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'trade-web',
	name: 'Trading Sites',
	description: 'Axiom, Fomo and Forex Factory as isolated, persistent webview tabs.',
	room: 'trade',
	defaultEnabled: true,
});
