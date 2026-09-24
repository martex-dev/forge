import { join } from 'node:path';

import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';

import { registerAppHandlers } from './core/app-handlers';
import { createDataServices, registerDataHandlers } from './core/data-handlers';
import { type DbHandle, openDatabase } from './core/db/client';
import { attachIpc, router } from './core/ipc';
import { createModuleRegistry } from './core/modules/bootstrap';
import type { ModuleRegistry } from './core/modules/registry';
import { createSecretsService, registerSecretsHandlers } from './core/secrets/secrets-handlers';
import { installGlobalSecurity } from './core/security';
import { createMainWindow } from './core/window';

// Logs live next to the rest of userData so --user-data-dir (tests) isolates them too.
log.transports.file.resolvePathFn = () => join(app.getPath('userData'), 'logs', 'main.log');
log.initialize();

let db: DbHandle | null = null;
let modules: ModuleRegistry | null = null;

async function start(): Promise<void> {
	installGlobalSecurity();
	attachIpc();

	db = openDatabase(join(app.getPath('userData'), 'forge.db'));
	const data = createDataServices(db);
	const secrets = createSecretsService();

	registerAppHandlers();
	registerDataHandlers(data);
	registerSecretsHandlers(secrets);
	// TODO(phase-0): replaced by SidecarManager in step 0.11.
	router.handle('sidecar:getStatus', () => ({ state: 'disabled' as const, attempt: 0 }));
	router.handle('sidecar:restart', () => ({ state: 'disabled' as const, attempt: 0 }));

	modules = createModuleRegistry(data.settings);
	await modules.start();

	createMainWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
	});
}

app.whenReady()
	.then(start)
	.catch((error: unknown) => {
		log.error('[main] fatal startup error', error);
		app.exit(1);
	});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});

let shuttingDown = false;
app.on('before-quit', (event) => {
	if (shuttingDown) return;
	shuttingDown = true;
	event.preventDefault();
	void (async () => {
		try {
			await modules?.stopAll();
		} catch (error) {
			log.error('[main] error while stopping modules', error);
		}
		db?.close();
		db = null;
		app.quit();
	})();
});
