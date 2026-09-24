import { join } from 'node:path';

import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';

import { registerAppHandlers } from './core/app-handlers';
import { createDataServices, registerDataHandlers } from './core/data-handlers';
import { type DbHandle, openDatabase } from './core/db/client';
import { attachIpc } from './core/ipc';
import { installGlobalSecurity } from './core/security';
import { createMainWindow } from './core/window';

log.initialize();

let db: DbHandle | null = null;

app.whenReady().then(() => {
	installGlobalSecurity();
	attachIpc();

	db = openDatabase(join(app.getPath('userData'), 'forge.db'));
	const data = createDataServices(db);

	registerAppHandlers();
	registerDataHandlers(data);
	createMainWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
	db?.close();
	db = null;
});
