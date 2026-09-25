import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'notebooks',
	name: 'Notebooks',
	description:
		'Open and run Jupyter notebooks with kernels from your own environments: code and Markdown cells, rich outputs, autosave.',
	room: 'lab',
	defaultEnabled: true,
});
