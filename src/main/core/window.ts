import { join } from 'node:path';

import { BrowserWindow } from 'electron';

import { APP_NAME } from '@shared/constants';

export function createMainWindow(): BrowserWindow {
	const win = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 960,
		minHeight: 600,
		title: APP_NAME,
		show: false,
		backgroundColor: '#07080A',
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
			webSecurity: true,
		},
	});

	win.once('ready-to-show', () => win.show());

	const devUrl = process.env['ELECTRON_RENDERER_URL'];
	if (devUrl) {
		void win.loadURL(devUrl);
	} else {
		void win.loadFile(join(__dirname, '../renderer/index.html'));
	}

	return win;
}
