import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'build-core',
	name: 'Build Core',
	description: 'Welcome panel for the Build room: editor, terminals, Git and deploys.',
	room: 'build',
	defaultEnabled: true,
});
