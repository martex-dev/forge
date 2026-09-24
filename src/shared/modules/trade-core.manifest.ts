import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'trade-core',
	name: 'Trade Core',
	description: 'Welcome panel for the Trade room: calendars, watchlists, charts and brokers.',
	room: 'trade',
	defaultEnabled: true,
});
