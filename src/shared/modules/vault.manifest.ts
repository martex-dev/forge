import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'vault',
	name: 'Obsidian Vault',
	description:
		'Browse, edit and search your Obsidian vault: wikilinks, tags, backlinks, quick notes.',
	room: 'hub',
	defaultEnabled: true,
});
