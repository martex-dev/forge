import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'lsp',
	name: 'Language Servers',
	description:
		'Hover, completion, diagnostics, go-to-definition and rename for Python (basedpyright) and TypeScript/JavaScript.',
	room: 'build',
	defaultEnabled: true,
});
