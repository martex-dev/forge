import { app, BrowserWindow } from 'electron';

import { router } from './ipc';
import { openExternalSafely } from './security';

export function registerAppHandlers(): void {
	router.handle('app:getVersion', () => app.getVersion());
	router.handle('app:getPlatform', () => process.platform);
	router.handle('app:reloadWindow', () => {
		BrowserWindow.getFocusedWindow()?.webContents.reload();
	});
	router.handle('app:openExternal', (url) => openExternalSafely(url));
}
