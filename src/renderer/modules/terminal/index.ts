import { Bot, Sparkles, SquareTerminal, TerminalSquare, Wand2 } from 'lucide-react';

import type { TerminalPresetId } from '@shared/ipc/channels/terminal';
import { manifest } from '@shared/modules/terminal.manifest';

import { getLayoutApi, nextInstanceId } from '../../app/layout/layout-controller';
import { call } from '../../lib/ipc';
import type { CommandDefinition, RendererModule } from '../types';
import { sessionIdFor, TerminalPanel } from './TerminalPanel';

const LABELS: Record<TerminalPresetId, string> = {
	powershell: 'PowerShell',
	python: 'Python',
	claude: 'Claude Code',
	codex: 'Codex',
	gemini: 'Gemini',
};

function newTerminal(
	preset: TerminalPresetId,
	shortcut?: string,
	icon = TerminalSquare,
): CommandDefinition {
	return {
		id: `terminal.new.${preset}`,
		title:
			preset === 'powershell'
				? 'Build: New Terminal'
				: `Build: New ${LABELS[preset]} Terminal`,
		room: 'build',
		keywords: ['terminal', 'shell', 'console', LABELS[preset].toLowerCase()],
		icon,
		...(shortcut ? { shortcut } : {}),
		run: (ctx) => {
			ctx.switchRoom('build');
			const api = getLayoutApi('build');
			if (!api) return;
			const instanceId = nextInstanceId(api, 'terminal.session');
			ctx.openPanel('terminal.session', {
				instanceId,
				title: `${LABELS[preset]} ${instanceId.split('#')[1] ?? ''}`.trim(),
				params: { preset, sessionId: crypto.randomUUID() },
			});
		},
	};
}

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: 'terminal.session',
			title: 'Terminal',
			room: 'build',
			icon: SquareTerminal,
			component: TerminalPanel,
			renderer: 'always',
			position: 'below',
			initialSize: 260,
			// Closing the tab ends the shell; a window reload does not (it reattaches).
			onClose: (params, panelId) => {
				void call('terminal:kill', sessionIdFor(panelId, params)).catch(() => undefined);
			},
		},
	],
	commands: [
		newTerminal('powershell', 'Ctrl+Shift+`', TerminalSquare),
		newTerminal('python', undefined, SquareTerminal),
		newTerminal('claude', undefined, Sparkles),
		newTerminal('codex', undefined, Bot),
		newTerminal('gemini', undefined, Wand2),
	],
};
