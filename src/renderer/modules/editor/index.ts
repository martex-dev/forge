import { FileCode2, Save, SaveAll, X } from 'lucide-react';

import { manifest } from '@shared/modules/editor.manifest';

import type { RendererModule } from '../types';
import { useEditorStore } from './editor-store';
import { EditorBridge } from './EditorBridge';
import { EditorPanel } from './EditorPanel';
import { requestClose, saveAll, saveFile } from './file-ops';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'editor.main',
			title: 'Editor',
			room: 'build',
			icon: FileCode2,
			component: EditorPanel,
			defaultOpen: true,
			// Stays mounted so switching dock tabs doesn't recreate Monaco.
			renderer: 'always',
			position: 'tab',
		},
	],
	commands: [
		{
			id: 'editor.save',
			title: 'Build: Save',
			room: 'build',
			shortcut: 'Ctrl+S',
			icon: Save,
			run: async () => {
				const active = useEditorStore.getState().active;
				if (active) await saveFile(active);
			},
		},
		{
			id: 'editor.saveAll',
			title: 'Build: Save All',
			room: 'build',
			shortcut: 'Ctrl+Alt+S',
			icon: SaveAll,
			run: saveAll,
		},
		{
			id: 'editor.close',
			title: 'Build: Close Editor Tab',
			room: 'build',
			shortcut: 'Ctrl+W',
			icon: X,
			run: () => {
				const active = useEditorStore.getState().active;
				if (active) requestClose(active);
			},
		},
		{
			id: 'editor.show',
			title: 'Build: Show Editor',
			room: 'build',
			icon: FileCode2,
			run: (ctx) => ctx.openPanel('editor.main'),
		},
	],
	statusItems: [{ id: 'editor.status', side: 'right', order: 0, component: EditorBridge }],
};
