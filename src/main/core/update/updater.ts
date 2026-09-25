import { app } from 'electron';
import log from 'electron-log/main';
import { autoUpdater } from 'electron-updater';

import type { UpdateStatus } from '@shared/ipc/channels/update';

import { emitEvent, router } from '../ipc';
import type { Notifier } from '../notify';
import { describeUpdateError, reduceUpdate, type UpdaterEvent } from './update-state';

const ulog = log.scope('update');
const FIRST_CHECK_MS = 60_000;
const EVERY_MS = 6 * 60 * 60_000;

function initialStatus(): UpdateStatus {
	if (!app.isPackaged) return { state: 'disabled', reason: 'Development build' };
	if (process.env['FORGE_E2E'] === '1') return { state: 'disabled', reason: 'Test run' };
	return { state: 'idle', lastChecked: null };
}

/**
 * Background updates from the public releases repo (ADR-023). The installer downloads while
 * Forge runs; it installs on "Restart to update", or on the next quit if you don't.
 */
export function registerUpdater(notify: Notifier, autoUpdate: () => boolean): void {
	let status = initialStatus();
	const apply = (event: UpdaterEvent): void => {
		const next = reduceUpdate(status, event);
		if (next === status) return;
		const becameReady = next.state === 'ready' && status.state !== 'ready';
		status = next;
		emitEvent('update:changed', status);
		if (becameReady && next.state === 'ready') {
			notify({
				module: 'core',
				title: `Forge ${next.version} is ready`,
				body: 'Restart to update from the status bar or the command palette. It also installs when you quit.',
				level: 'success',
			});
		}
	};

	router.handle('update:status', () => status);
	router.handle('update:install', () => {
		if (status.state === 'ready') autoUpdater.quitAndInstall(true, true);
	});
	if (status.state === 'disabled') {
		router.handle('update:check', () => status);
		return;
	}

	autoUpdater.logger = ulog;
	autoUpdater.autoDownload = true;
	autoUpdater.autoInstallOnAppQuit = true;
	autoUpdater.on('checking-for-update', () => apply({ type: 'checking' }));
	autoUpdater.on('update-available', (info) =>
		apply({ type: 'available', version: info.version }),
	);
	autoUpdater.on('download-progress', (p) => apply({ type: 'progress', percent: p.percent }));
	autoUpdater.on('update-downloaded', (info) =>
		apply({ type: 'downloaded', version: info.version }),
	);
	autoUpdater.on('update-not-available', () => apply({ type: 'not-available', at: Date.now() }));
	autoUpdater.on('error', (error) => {
		ulog.warn('update check failed', error);
		apply({ type: 'error', message: describeUpdateError(error), at: Date.now() });
	});

	const check = async (): Promise<UpdateStatus> => {
		try {
			await autoUpdater.checkForUpdates();
		} catch (error) {
			// Also reported through the 'error' event; the answer here is the current status.
			ulog.warn('checkForUpdates threw', error);
		}
		return status;
	};
	router.handle('update:check', check);
	const background = (): void => {
		if (autoUpdate()) void check();
	};
	setTimeout(background, FIRST_CHECK_MS).unref();
	setInterval(background, EVERY_MS).unref();
}
