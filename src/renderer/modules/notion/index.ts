import { BookText } from 'lucide-react';

import { manifest } from '@shared/modules/notion.manifest';

import type { RendererModule } from '../types';
import { NotionPanel } from './NotionPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'notion.panel',
			title: 'Notion',
			room: 'hub',
			icon: BookText,
			component: NotionPanel,
			position: 'tab',
		},
	],
	commands: [
		{
			id: 'notion.show',
			title: 'Hub: Notion Pages',
			room: 'hub',
			keywords: ['notion', 'notes', 'wiki', 'todo', 'pages'],
			icon: BookText,
			run: (ctx) => ctx.openPanel('notion.panel'),
		},
	],
};
