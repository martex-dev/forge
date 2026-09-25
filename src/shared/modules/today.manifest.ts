import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'today',
	name: 'Today',
	description:
		'The day at a glance: macro events and earnings, trading P/L, alerts, training runs, builds and deploys, unread inbox.',
	room: 'hub',
	defaultEnabled: true,
});
