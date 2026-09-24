import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'lab-core',
	name: 'Lab Core',
	description: 'Welcome panel for the Lab room: training runs, GPU and datasets.',
	room: 'lab',
	defaultEnabled: true,
});
