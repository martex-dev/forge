import { join } from 'node:path';

import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';

import { registerAppHandlers } from './core/app-handlers';
import { createDataServices, registerDataHandlers } from './core/data-handlers';
import { type DbHandle, openDatabase } from './core/db/client';
import { attachIpc } from './core/ipc';
import { createModuleRegistry } from './core/modules/bootstrap';
import type { ModuleRegistry } from './core/modules/registry';
import { createNotifier } from './core/notify';
import { createSecretsService, registerSecretsHandlers } from './core/secrets/secrets-handlers';
import { installGlobalSecurity } from './core/security';
import { createSidecar } from './core/sidecar';
import type { SidecarManager } from './core/sidecar/sidecar-manager';
import { createMainWindow } from './core/window';

// Logs live next to the rest of userData so --user-data-dir (tests) isolates them too.
log.transports.file.resolvePathFn = () => join(app.getPath('userData'), 'logs', 'main.log');
log.initialize();

let db: DbHandle | null = null;
let modules: ModuleRegistry | null = null;
let sidecar: SidecarManager | null = null;

async function start(): Promise<void> {
	installGlobalSecurity();
	attachIpc();

	db = openDatabase(join(app.getPath('userData'), 'forge.db'));
	const data = createDataServices(db);
	const secrets = createSecretsService();
	const notify = createNotifier(data.notifications);

	registerAppHandlers();
	registerDataHandlers(data, notify);
	registerSecretsHandlers(secrets);
	sidecar = createSidecar(notify);

	modules = createModuleRegistry({ settings: data.settings, secrets, notify, sidecar });
	await modules.start();

	createMainWindow();
	// Started after the window so a slow first `uv sync` never delays the UI.
	void sidecar?.start();

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
			await sidecar?.stop();
		} catch (error) {
			log.error('[main] error during shutdown', error);
		}
		db?.close();
		db = null;
		app.quit();
	})();
});
