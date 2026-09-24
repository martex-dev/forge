import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'hub-core',
	name: 'Hub Core',
	description: 'Welcome panel for the Hub room: notes, inbox and comms.',
	room: 'hub',
	defaultEnabled: true,
});
