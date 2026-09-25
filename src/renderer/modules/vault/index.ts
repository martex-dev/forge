import { BookOpen, FilePlus2, FileText, FolderOpen, NotebookPen, Search } from 'lucide-react';

import { manifest } from '@shared/modules/vault.manifest';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import type { RendererModule } from '../types';
import { NewNoteDialog, useNewNote } from './NewNoteDialog';
import { NotePanel } from './NotePanel';
import { QuickNoteDialog, useQuickNote } from './QuickNoteDialog';
import { NOTE_PANEL, useVaultUi } from './use-vault';
import { VaultPanel } from './VaultPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'vault.sidebar',
			title: 'Vault',
			room: 'hub',
			icon: BookOpen,
			component: VaultPanel,
			defaultOpen: true,
			position: 'left',
			initialSize: 280,
		},
		{
			id: NOTE_PANEL,
			title: 'Note',
			room: 'hub',
			icon: FileText,
			component: NotePanel,
			defaultOpen: true,
			position: 'tab',
		},
	],
	commands: [
		{
			id: 'vault.quickNote',
			title: 'Hub: Quick Note',
			room: 'global',
			shortcut: 'Ctrl+Alt+N',
			keywords: ['obsidian', 'daily', 'capture', 'idea', 'todo'],
			icon: NotebookPen,
			run: async () => {
				const info = await call('vault:info');
				if (!info.root) {
					toast.warn(
						'No vault open',
						'Choose your Obsidian vault in the Hub room first.',
					);
					return;
				}
				useQuickNote.getState().setOpen(true);
			},
		},
		{
			id: 'vault.newNote',
			title: 'Hub: New Note',
			room: 'hub',
			keywords: ['obsidian', 'create'],
			icon: FilePlus2,
			run: (ctx) => {
				ctx.openPanel('vault.sidebar');
				useNewNote.getState().open();
			},
		},
		{
			id: 'vault.search',
			title: 'Hub: Search Notes',
			room: 'hub',
			keywords: ['obsidian', 'find', 'full text'],
			icon: Search,
			run: (ctx) => {
				useVaultUi.getState().setView('search');
				ctx.openPanel('vault.sidebar');
			},
		},
		{
			id: 'vault.choose',
			title: 'Hub: Open Obsidian Vault…',
			room: 'hub',
			keywords: ['obsidian', 'folder'],
			icon: FolderOpen,
			run: async (ctx) => {
				ctx.openPanel('vault.sidebar');
				await call('vault:openDialog');
			},
		},
	],
	overlays: [QuickNoteDialog, NewNoteDialog],
};
