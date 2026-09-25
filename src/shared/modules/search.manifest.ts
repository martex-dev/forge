import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'search',
	name: 'Search',
	description: 'Find in files across the open folder (ripgrep): regex, case, whole word, globs.',
	room: 'build',
	defaultEnabled: true,
});
