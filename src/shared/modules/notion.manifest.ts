import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'notion',
	name: 'Notion',
	description:
		'Search and read your Notion pages, append to-dos and notes, create sub-pages (official API, pages shared with your integration).',
	room: 'hub',
	requiredSecrets: [
		{
			key: 'notion.token',
			label: 'Notion integration token',
			help: 'notion.so/profile/integrations → New integration (internal) → copy the secret. Then share pages with it: ••• → Connections.',
		},
	],
	defaultEnabled: true,
});
