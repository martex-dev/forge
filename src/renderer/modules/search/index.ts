import { Search } from 'lucide-react';

import { manifest } from '@shared/modules/search.manifest';

import type { RendererModule } from '../types';
import { SearchPanel } from './SearchPanel';
import { useSearchFocus } from './use-search';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'search.files',
			title: 'Search',
			room: 'build',
			icon: Search,
			component: SearchPanel,
			defaultOpen: true,
			tabWith: 'explorer.tree',
		},
	],
	commands: [
		{
			id: 'search.inFiles',
			title: 'Build: Search in Files',
			room: 'build',
			shortcut: 'Ctrl+Shift+F',
			keywords: ['find', 'grep', 'ripgrep', 'text'],
			icon: Search,
			run: (ctx) => {
				ctx.openPanel('search.files');
				useSearchFocus.getState().focus();
			},
		},
	],
};
