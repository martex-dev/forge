import { join } from 'node:path';

import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';

import { APP_ID } from '@shared/constants';
import { DEFAULT_GENERAL, GeneralSettingsSchema } from '@shared/settings';

import { registerAppHandlers } from './core/app-handlers';
import { registerAppScheme, serveRenderer } from './core/app-protocol';
import { registerBackupHandlers } from './core/backup/backup-handlers';
import { applyStaged, BackupService } from './core/backup/backup-service';
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
import { registerUpdater } from './core/update/updater';
import { createWebviews } from './core/webviews';
import type { WebviewService } from './core/webviews/webview-service';
import { createMainWindow } from './core/window';
import { createWorkspace } from './core/workspace';
import type { WorkspaceWatcher } from './core/workspace/watcher';

// Logs live next to the rest of userData so --user-data-dir (tests) isolates them too.
log.transports.file.resolvePathFn = () => join(app.getPath('userData'), 'logs', 'main.log');
log.initialize();
registerAppScheme();
// Without this, Windows shows toasts as "electron.app.Electron" (or drops them in dev).
if (process.platform === 'win32') app.setAppUserModelId(APP_ID);

let db: DbHandle | null = null;
let modules: ModuleRegistry | null = null;
let sidecar: SidecarManager | null = null;
let watcher: WorkspaceWatcher | null = null;

async function start(): Promise<void> {
	installGlobalSecurity();
	serveRenderer(join(__dirname, '../renderer'));
	attachIpc();

	db = openDatabase(join(app.getPath('userData'), 'forge.db'));
	// A restore staged module folders (journal…); swap them in before any module opens them.
	const restored = applyStaged(app.getPath('userData'));
	if (restored.length) log.info('[backup] applied staged restore', { restored });
	const data = createDataServices(db);
	const backup = new BackupService(
		app.getPath('userData'),
		data.settings,
		data.layouts,
		app.getVersion(),
	);
	registerBackupHandlers(backup);
	const secrets = createSecretsService();
	const notify = createNotifier(data.notifications, () => mainWindow);

	registerAppHandlers(data.settings);
	registerDataHandlers(data, notify);
	registerSecretsHandlers(secrets);
	registerUpdater(
		notify,
		() => data.settings.get('general', GeneralSettingsSchema, DEFAULT_GENERAL).autoUpdate,
	);
	sidecar = createSidecar(notify);

	const webviews = createWebviews(() => mainWindow);
	const ws = createWorkspace(data.settings);
	watcher = ws.watcher;

	modules = createModuleRegistry({
		settings: data.settings,
		secrets,
		notify,
		sidecar,
		workspace: ws.workspace,
		backup,
	});
	await modules.start();

	openWindow(webviews);
	// Started after the window so a slow first `uv sync` never delays the UI.
	void sidecar?.start();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) openWindow(webviews);
	});
}

let mainWindow: BrowserWindow | null = null;

function openWindow(webviews: WebviewService): void {
	const win = createMainWindow();
	mainWindow = win;
	win.on('closed', () => {
		// Views belong to the window; drop our references so a new window starts clean.
		webviews.destroyAll();
		if (mainWindow === win) mainWindow = null;
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
			await watcher?.stop();
		} catch (error) {
			log.error('[main] error during shutdown', error);
		}
		db?.close();
		db = null;
		app.quit();
	})();
});
