import { BarChart3, BookOpenText, NotebookPen } from 'lucide-react';

import { manifest } from '@shared/modules/journal.manifest';

import type { RendererModule } from '../types';
import { JournalPanel } from './JournalPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'journal.panel',
			title: 'Journal',
			room: 'trade',
			icon: BookOpenText,
			component: JournalPanel,
			defaultOpen: true,
			tabWith: 'calendar.week',
		},
	],
	commands: [
		{
			id: 'journal.show',
			title: 'Trade: Trade Journal',
			room: 'trade',
			keywords: ['journal', 'trades', 'log', 'review', 'diary'],
			icon: BookOpenText,
			run: (ctx) =>
				ctx.openPanel('journal.panel', { params: { editing: undefined, view: 'entries' } }),
		},
		{
			id: 'journal.new',
			title: 'Trade: New Journal Entry',
			room: 'trade',
			shortcut: 'Ctrl+Alt+J',
			keywords: ['journal', 'trade', 'log', 'idea', 'screenshot'],
			icon: NotebookPen,
			run: (ctx) =>
				ctx.openPanel('journal.panel', {
					params: { editing: crypto.randomUUID(), draft: undefined },
				}),
		},
		{
			id: 'journal.stats',
			title: 'Trade: Journal Stats',
			room: 'trade',
			keywords: ['journal', 'win rate', 'expectancy', 'equity', 'performance'],
			icon: BarChart3,
			run: (ctx) =>
				ctx.openPanel('journal.panel', { params: { editing: undefined, view: 'stats' } }),
		},
	],
};
