import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'git',
	name: 'Git',
	description:
		'Source control for the open folder: changes, diffs, stage, commit, pull and push.',
	room: 'build',
	defaultEnabled: true,
});
