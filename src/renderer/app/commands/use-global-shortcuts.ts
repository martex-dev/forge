import { useEffect, useRef } from 'react';

import { matchesShortcut } from '../../lib/shortcuts';
import type { CommandDefinition } from '../../modules/types';
import { runCommand } from './use-commands';

/**
 * Binds every command's `shortcut`. Capture phase so editors/terminals added later can't swallow
 * app-level shortcuts like Ctrl+K.
 */
export function useGlobalShortcuts(commands: readonly CommandDefinition[]): void {
	const ref = useRef(commands);
	useEffect(() => {
		ref.current = commands;
	});

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent): void => {
			if (!event.ctrlKey && !event.metaKey && !event.altKey) return;
			const command = ref.current.find(
				(c) => c.shortcut && matchesShortcut(event, c.shortcut),
			);
			if (!command) return;
			event.preventDefault();
			event.stopPropagation();
			void runCommand(command);
		};
		window.addEventListener('keydown', onKeyDown, { capture: true });
		return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
	}, []);
}
