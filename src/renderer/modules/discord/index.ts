import { Webhook } from 'lucide-react';

import { manifest } from '@shared/modules/discord.manifest';

import type { RendererModule } from '../types';
import { DiscordPanel } from './DiscordPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'discord.panel',
			title: 'Discord',
			room: 'hub',
			icon: Webhook,
			component: DiscordPanel,
			position: 'right',
			initialSize: 380,
		},
	],
	commands: [
		{
			id: 'discord.show',
			title: 'Hub: Discord Webhooks & Forwarding',
			room: 'hub',
			keywords: ['discord', 'webhook', 'post', 'forward', 'alerts', 'phone'],
			icon: Webhook,
			run: (ctx) => ctx.openPanel('discord.panel'),
		},
	],
};
