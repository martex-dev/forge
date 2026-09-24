import { useMemo } from 'react';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { ALL_PANELS, commandsFor, RENDERER_MODULES } from '../../modules/registry';
import type { CommandContext, CommandDefinition } from '../../modules/types';
import { toast } from '../../stores/toast-store';
import { useUiStore } from '../../stores/ui-store';
import { useModules } from '../hooks/use-modules';
import { getLayoutApi, openPanelIn } from '../layout/layout-controller';
import { resetRoomLayout } from '../layout/reset-layout';
import { BUILTIN_COMMANDS } from './builtin-commands';

/** The concrete implementation of what commands are allowed to do. */
export function createCommandContext(): CommandContext {
	const ui = useUiStore.getState;
	return {
		switchRoom: (room) => ui().setRoom(room),
		openPanel: (panelId) => {
			const def = ALL_PANELS.find((p) => p.id === panelId);
			if (!def) {
				toast.error('Unknown panel', panelId);
				return;
			}
			ui().setRoom(def.room);
			const api = getLayoutApi(def.room);
			if (api) openPanelIn(api, def);
		},
		resetLayout: (room) => void resetRoomLayout(room ?? ui().room),
		openSettings: (tab) => ui().openSettings(tab),
		openPalette: () => ui().setPaletteOpen(true),
		togglePlayground: () => ui().togglePlayground(),
		reloadWindow: () => {
			call('app:reloadWindow').catch((error: unknown) =>
				rlog.error('commands', 'reload failed', error),
			);
		},
	};
}

export const commandContext = createCommandContext();

export async function runCommand(command: CommandDefinition): Promise<void> {
	try {
		await command.run(commandContext);
	} catch (error) {
		rlog.error('commands', `command ${command.id} failed`, error);
		toast.error(
			`"${command.title}" failed`,
			error instanceof Error ? error.message : undefined,
		);
	}
}

/** Built-in commands plus commands of every currently enabled module. */
export function useCommands(): CommandDefinition[] {
	const { enabled } = useModules();
	return useMemo(
		() => [...BUILTIN_COMMANDS, ...commandsFor(RENDERER_MODULES, enabled)],
		[enabled],
	);
}
