import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'journal',
	name: 'Trade Journal',
	description:
		'Journal trades and ideas: entries with prices, size, tags, Markdown notes and screenshots; win rate, P/L and equity curve.',
	room: 'trade',
	defaultEnabled: true,
});
