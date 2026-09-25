import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'hub-web',
	name: 'Comms & Socials',
	description: 'Discord, LinkedIn, X and Notion as isolated, persistent webview tabs.',
	room: 'hub',
	defaultEnabled: true,
});
