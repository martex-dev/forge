import { app, BrowserWindow } from 'electron';
import log from 'electron-log/main';
import { z } from 'zod';

import type { SettingsRepo } from './db/settings-repo';
import { router } from './ipc';
import { openExternalSafely } from './security';

const Onboarded = z.boolean();

export function registerAppHandlers(settings: SettingsRepo): void {
	router.handle('app:getVersion', () => app.getVersion());
	router.handle('app:getPlatform', () => process.platform);
	router.handle('app:reloadWindow', () => {
		BrowserWindow.getFocusedWindow()?.webContents.reload();
	});
	router.handle('app:openExternal', (url) => openExternalSafely(url));
	router.handle('app:onboarding', () => ({
		show: process.env['FORGE_E2E'] !== '1' && !settings.get('onboarded', Onboarded, false),
	}));
	router.handle('app:onboardingDone', () => {
		settings.set('onboarded', Onboarded, true);
	});
	router.handle('app:log', ({ level, scope, message, detail }) => {
		log.scope(`renderer:${scope}`)[level](message, detail ?? '');
	});
}
