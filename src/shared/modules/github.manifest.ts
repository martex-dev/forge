import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'github',
	name: 'GitHub',
	description:
		"Pull requests, issues and Actions runs for the open folder's GitHub repo; CI and review notifications.",
	room: 'build',
	requiredSecrets: [
		{
			key: 'github.token',
			label: 'GitHub token',
			help: 'github.com → Settings → Developer settings → Fine-grained tokens. Read-only access to Metadata, Contents, Pull requests, Issues, Actions and Commit statuses for your repos.',
		},
	],
	defaultEnabled: true,
});
