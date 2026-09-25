import { app, BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import log from 'electron-log/main';

import { router } from '../ipc';
import type { BackupService } from './backup-service';

async function pickFolder(title: string): Promise<string | null> {
	const options: OpenDialogOptions = { title, properties: ['openDirectory', 'createDirectory'] };
	const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
	const result = win
		? await dialog.showOpenDialog(win, options)
		: await dialog.showOpenDialog(options);
	return result.canceled ? null : (result.filePaths[0] ?? null);
}

export function registerBackupHandlers(backup: BackupService): void {
	router.handle('backup:export', async () => {
		const parent = await pickFolder('Save a Forge backup in…');
		if (!parent) return null;
		const dir = await backup.exportTo(parent);
		log.info('[backup] exported', { dir });
		return dir;
	});
	router.handle('backup:pick', async () => {
		const dir = await pickFolder('Restore from a Forge backup folder');
		return dir ? backup.inspect(dir) : null;
	});
	router.handle('backup:restore', (dir) => {
		const result = backup.restore(dir);
		log.info('[backup] restored', { dir, ...result });
		return result;
	});
	router.handle('app:relaunch', () => {
		app.relaunch();
		app.quit();
	});
}
