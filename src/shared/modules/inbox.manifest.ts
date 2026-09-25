import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'inbox',
	name: 'Inbox',
	description: 'Every notification from every module: filter, mark read, jump to the source.',
	room: 'hub',
	defaultEnabled: true,
});
