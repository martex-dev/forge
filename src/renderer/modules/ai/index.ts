import { GitCompare, MessageSquareCode, TextSelect } from 'lucide-react';

import { manifest } from '@shared/modules/ai.manifest';

import type { RendererModule } from '../types';
import { AiStreamController } from './AiStreamController';
import { ApplyPreviewPanel } from './ApplyPreviewPanel';
import { attachCurrent, ChatPanel, useChatFocus } from './ChatPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'ai.chat',
			title: 'AI',
			room: 'build',
			icon: MessageSquareCode,
			component: ChatPanel,
			defaultOpen: true,
			position: 'right',
			initialSize: 380,
		},
		{
			id: 'ai.apply',
			title: 'Apply preview',
			room: 'build',
			icon: GitCompare,
			component: ApplyPreviewPanel,
			tabWith: 'editor.main',
		},
	],
	commands: [
		{
			id: 'ai.ask',
			title: 'Build: Ask AI',
			room: 'build',
			shortcut: 'Ctrl+L',
			keywords: ['claude', 'gpt', 'gemini', 'chat', 'assistant'],
			icon: MessageSquareCode,
			run: (ctx) => {
				ctx.openPanel('ai.chat');
				useChatFocus.getState().focus();
			},
		},
		{
			id: 'ai.askSelection',
			title: 'Build: Ask AI About Selection',
			room: 'build',
			shortcut: 'Ctrl+Shift+L',
			keywords: ['explain', 'refactor', 'selection'],
			icon: TextSelect,
			run: (ctx) => {
				if (!attachCurrent('selection')) return;
				ctx.openPanel('ai.chat');
				useChatFocus.getState().focus();
			},
		},
	],
	overlays: [AiStreamController],
};
