import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';

import { router } from './ipc';
import { openExternalSafely } from './security';

export function registerAppHandlers(): void {
	router.handle('app:getVersion', () => app.getVersion());
	router.handle('app:getPlatform', () => process.platform);
	router.handle('app:reloadWindow', () => {
		BrowserWindow.getFocusedWindow()?.webContents.reload();
	});
	router.handle('app:openExternal', (url) => openExternalSafely(url));
	router.handle('app:log', ({ level, scope, message, detail }) => {
		log.scope(`renderer:${scope}`)[level](message, detail ?? '');
	});
}
