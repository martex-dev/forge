import { useQueryClient } from '@tanstack/react-query';
import { type JSX, useEffect, useRef } from 'react';

import type { WorkspaceInfo } from '@shared/ipc/channels/workspace';

import { commandContext } from '../../app/commands/use-commands';
import { useGeneralSettings } from '../../app/hooks/use-general-settings';
import { useWorkspace, WORKSPACE_KEY } from '../../app/hooks/use-workspace';
import { rlog } from '../../lib/log';
import { useForgeEvent } from '../../lib/use-forge-event';
import { toast } from '../../stores/toast-store';
import { useUiStore } from '../../stores/ui-store';
import { useWorkbenchStore } from '../../stores/workbench-store';
import { dirtyCount, useEditorStore } from './editor-store';
import { closeAll, onExternalChange, openFile } from './file-ops';
import { loadMonaco, refreshEditorConfiguration } from './monaco/load';
import { loadSession, saveSession } from './session';

/**
 * Status-bar item (cursor · language · EOL) that also connects the editor to the rest of the
 * app while the module is enabled: open-file requests, the leave-workspace guard, external file
 * changes, per-folder tab sessions and theme refresh.
 */
export function EditorBridge(): JSX.Element | null {
	const client = useQueryClient();
	const { info } = useWorkspace();
	const { settings } = useGeneralSettings();
	const room = useUiStore((s) => s.room);
	const cursor = useEditorStore((s) => s.cursor);
	const active = useEditorStore((s) => s.active);
	const settingsRef = useRef(settings);
	useEffect(() => {
		settingsRef.current = settings;
	});

	// Open-file requests from other modules (explorer, search, git…).
	useEffect(() => {
		const { setOpenFileHandler } = useWorkbenchStore.getState();
		setOpenFileHandler((request) => {
			const root = client.getQueryData<WorkspaceInfo>(WORKSPACE_KEY)?.root;
			if (!root) return;
			commandContext.openPanel('editor.main');
			const { fontSize, reduceMotion } = settingsRef.current;
			loadMonaco(fontSize, reduceMotion)
				.then(async (monaco) => {
					await openFile(monaco, root, request.path);
					if (request.line) {
						useEditorStore.getState().setReveal({
							path: request.path,
							line: request.line,
							column: request.column ?? 1,
						});
					}
				})
				.catch((error: unknown) => {
					rlog.error('editor', 'editor failed to load', error);
					toast.error(
						'The editor failed to load',
						error instanceof Error ? error.message : undefined,
					);
				});
		});
		const removeGuard = useWorkbenchStore.getState().addLeaveGuard(() => {
			const n = dirtyCount();
			return n > 0 ? `Save or close ${n} unsaved file${n === 1 ? '' : 's'} first.` : null;
		});
		return () => {
			setOpenFileHandler(null);
			removeGuard();
		};
	}, [client]);

	useEffect(() => useWorkbenchStore.getState().setActiveFile(active), [active]);

	useForgeEvent('fs:changed', ({ files }) => onExternalChange(files));

	// New folder → close the old folder's tabs and restore this folder's session.
	const root = info.root;
	useEffect(() => {
		closeAll();
		if (!root) return;
		const session = loadSession(root);
		if (session.files.length === 0) return;
		const { fontSize, reduceMotion } = settingsRef.current;
		loadMonaco(fontSize, reduceMotion)
			.then(async (monaco) => {
				for (const path of session.files) await openFile(monaco, root, path);
				if (session.active) useEditorStore.getState().setActive(session.active);
			})
			.catch((error: unknown) => rlog.warn('editor', 'session restore failed', error));
	}, [root]);

	useEffect(() => {
		if (!root) return;
		return useEditorStore.subscribe((s) =>
			saveSession(root, { files: s.files.map((f) => f.path), active: s.active }),
		);
	}, [root]);

	// Accent (room) and font settings feed the editor theme.
	useEffect(() => {
		void refreshEditorConfiguration(settings.fontSize, settings.reduceMotion).catch(
			(error: unknown) => rlog.warn('editor', 'theme refresh failed', error),
		);
	}, [room, settings.fontSize, settings.reduceMotion]);

	if (!cursor || !active) return null;
	return (
		<span className='num flex items-center gap-3 text-fg-1'>
			<span>
				Ln {cursor.line}, Col {cursor.column}
			</span>
			<span>{cursor.language}</span>
			<span>{cursor.eol}</span>
		</span>
	);
}
