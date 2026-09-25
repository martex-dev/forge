import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'editor',
	name: 'Editor',
	description:
		'Monaco editor (VS Code engine): tabs, save, conflict detection, TextMate highlighting.',
	room: 'build',
	defaultEnabled: true,
});
