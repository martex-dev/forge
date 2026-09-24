import { join } from 'node:path';

import { BrowserWindow, Menu } from 'electron';

import { APP_NAME, WINDOW_CHROME } from '@shared/constants';

import { lockWindowNavigation } from './security';

export function createMainWindow(): BrowserWindow {
	// No native menu: its default accelerators (Ctrl+W, Ctrl+R…) would fight app shortcuts.
	Menu.setApplicationMenu(null);

	const win = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 960,
		minHeight: 600,
		title: APP_NAME,
		show: false,
		backgroundColor: WINDOW_CHROME.background,
		titleBarStyle: 'hidden',
		titleBarOverlay: {
			color: WINDOW_CHROME.background,
			symbolColor: WINDOW_CHROME.symbol,
			height: WINDOW_CHROME.titleBarHeight,
		},
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			contextIsolation: true,
			sandbox: true,
			nodeIntegration: false,
			webSecurity: true,
		},
	});

	lockWindowNavigation(win);
	win.once('ready-to-show', () => win.show());

	const devUrl = process.env['ELECTRON_RENDERER_URL'];

	// With the menu gone, keep devtools reachable in development only.
	if (devUrl) {
		win.webContents.on('before-input-event', (_event, input) => {
			if (input.type === 'keyDown' && input.key === 'F12') win.webContents.toggleDevTools();
		});
	}

	if (devUrl) {
		void win.loadURL(devUrl);
	} else {
		void win.loadFile(join(__dirname, '../renderer/index.html'));
	}

	return win;
}
