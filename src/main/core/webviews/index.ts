import { type BrowserWindow } from 'electron';

import { emitEvent, router } from '../ipc';
import { WebviewService } from './webview-service';

export function createWebviews(getWindow: () => BrowserWindow | null): WebviewService {
	const service = new WebviewService(getWindow, (state) => emitEvent('webview:state', state));

	router.handle('webview:attach', ({ instanceId, serviceId }) =>
		service.attach(instanceId, serviceId),
	);
	router.handle('webview:detach', (instanceId) => service.detach(instanceId));
	router.handle('webview:setBounds', ({ instanceId, bounds, visible }) =>
		service.setBounds(instanceId, bounds, visible),
	);
	router.handle('webview:navigate', ({ instanceId, action }) =>
		service.navigate(instanceId, action),
	);

	// Exposed only for e2e tests, which inspect visibility from the main process.
	if (process.env['FORGE_E2E'] === '1') {
		(globalThis as { __forgeWebviews?: WebviewService }).__forgeWebviews = service;
	}
	return service;
}
