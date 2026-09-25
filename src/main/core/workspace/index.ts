import { BrowserWindow, dialog, shell } from 'electron';
import log from 'electron-log/main';

import type { SettingsRepo } from '../db/settings-repo';
import { emitEvent, router } from '../ipc';
import { FsService } from './fs-service';
import { WorkspaceWatcher } from './watcher';
import { WorkspaceService } from './workspace-service';

export interface WorkspaceServices {
	workspace: WorkspaceService;
	fs: FsService;
	watcher: WorkspaceWatcher;
}

export function createWorkspace(settings: SettingsRepo): WorkspaceServices {
	const workspace = new WorkspaceService(settings);
	const fs = new FsService({
		getRoot: () => workspace.getRoot(),
		trash: (abs) => shell.trashItem(abs),
		reveal: (abs) => shell.showItemInFolder(abs),
	});
	const watcher = new WorkspaceWatcher(
		(batch) => emitEvent('fs:changed', batch),
		(error) => log.scope('watcher').warn('watch error', error),
	);

	const restartWatcher = (root: string | null): void => {
		if (root) watcher.start(root);
		else void watcher.stop();
	};
	restartWatcher(workspace.getRoot());
	workspace.onChange((info) => {
		restartWatcher(info.root);
		emitEvent('workspace:changed', info);
	});

	router.handle('workspace:get', () => workspace.info());
	router.handle('workspace:openDialog', async () => {
		const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
		const current = workspace.getRoot();
		const options: Electron.OpenDialogOptions = {
			title: 'Open Folder',
			properties: ['openDirectory'],
			...(current ? { defaultPath: current } : {}),
		};
		const result = win
			? await dialog.showOpenDialog(win, options)
			: await dialog.showOpenDialog(options);
		const picked = result.filePaths[0];
		if (result.canceled || !picked) return workspace.info();
		return workspace.open(picked);
	});
	router.handle('workspace:open', (path) => workspace.open(path));
	router.handle('workspace:close', () => workspace.close());
	router.handle('workspace:forgetRecent', (path) => workspace.forgetRecent(path));

	router.handle('fs:list', (rel) => fs.list(rel));
	router.handle('fs:readFile', (rel) => fs.readFile(rel));
	router.handle('fs:writeFile', ({ path, content, expectedMtimeMs }) =>
		fs.writeFile(path, content, expectedMtimeMs),
	);
	router.handle('fs:create', ({ parent, name, kind }) => fs.create(parent, name, kind));
	router.handle('fs:rename', ({ path, newName }) => fs.rename(path, newName));
	router.handle('fs:trash', (rel) => fs.trash(rel));
	router.handle('fs:reveal', (rel) => fs.reveal(rel));

	return { workspace, fs, watcher };
}
