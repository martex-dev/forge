import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'explorer',
	name: 'Explorer',
	description: 'File tree for the open folder: create, rename, delete (to Recycle Bin), reveal.',
	room: 'build',
	defaultEnabled: true,
});
