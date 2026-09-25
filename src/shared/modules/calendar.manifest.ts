import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'calendar',
	name: 'Economic Calendar',
	description:
		'This week’s macro events (Forex Factory feed): impact/currency filters, countdown.',
	room: 'trade',
	defaultEnabled: true,
});
