import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'discord',
	name: 'Discord',
	description:
		'Post to Discord channels through webhooks, and forward chosen Forge notifications (alerts, runs, deploys) there. No user tokens or bots.',
	room: 'hub',
	requiredSecrets: [
		{
			key: 'discord.webhooks',
			label: 'Discord webhooks (managed in the Discord panel)',
			help: 'Add webhooks from Hub → Discord; this entry holds their URLs. Removing it forgets them all.',
		},
	],
	defaultEnabled: true,
});
