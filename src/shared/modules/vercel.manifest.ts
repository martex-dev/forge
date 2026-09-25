import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'vercel',
	name: 'Vercel',
	description:
		'Projects and deployments with status, build and runtime logs, promote/rollback (confirmed), deploy notifications.',
	room: 'build',
	requiredSecrets: [
		{
			key: 'vercel.token',
			label: 'Vercel token',
			help: 'vercel.com → Account Settings → Tokens. Scope it to your account or team.',
		},
	],
	defaultEnabled: true,
});
