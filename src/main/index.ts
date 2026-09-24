import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';

import { installGlobalSecurity } from './core/security';
import { createMainWindow } from './core/window';

log.initialize();

app.whenReady().then(() => {
	installGlobalSecurity();
	createMainWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
