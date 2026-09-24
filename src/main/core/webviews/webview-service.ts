import { type BrowserWindow, session, WebContentsView } from 'electron';
import log from 'electron-log/main';

import type { Bounds, WebviewState } from '@shared/ipc/channels/webview';
import { getWebService, isServiceHost, partitionFor, type WebService } from '@shared/webviews';

import { ForgeError } from '../errors';
import { openExternalSafely } from '../security';

interface Instance {
	service: WebService;
	view: WebContentsView;
	error: string | null;
}

const wlog = log.scope('webview');

/** Chromium UA without the "Electron/x" and app tokens that some sites (and Google sign-in) reject. */
function cleanUserAgent(ua: string): string {
	return ua
		.replace(/\sElectron\/\S+/i, '')
		.replace(/\sforge\/\S+/i, '')
		.trim();
}

const configuredPartitions = new Set<string>();

function configurePartition(service: WebService): Electron.Session {
	const partition = partitionFor(service.id);
	const ses = session.fromPartition(partition);
	if (configuredPartitions.has(partition)) return ses;
	configuredPartitions.add(partition);
	ses.setUserAgent(cleanUserAgent(ses.getUserAgent()));
	// Third-party sites get no camera/mic/geolocation/notifications from Forge.
	ses.setPermissionRequestHandler((_wc, permission, callback) => {
		callback(permission === 'clipboard-sanitized-write' || permission === 'fullscreen');
	});
	return ses;
}

/**
 * Hosts third-party sites in WebContentsViews layered over the main window. Views have no
 * preload and no Node, each service has its own persistent partition, and anything that
 * leaves the service's hosts opens in the system browser instead.
 */
export class WebviewService {
	private readonly instances = new Map<string, Instance>();

	constructor(
		private readonly getWindow: () => BrowserWindow | null,
		private readonly onState: (state: WebviewState) => void,
	) {}

	attach(instanceId: string, serviceId: string): WebviewState {
		const existing = this.instances.get(instanceId);
		if (existing) return this.stateOf(instanceId, existing);

		const service = getWebService(serviceId);
		if (!service)
			throw new ForgeError('WEBVIEW_UNKNOWN_SERVICE', `Unknown service "${serviceId}"`);
		const win = this.getWindow();
		if (!win) throw new ForgeError('WEBVIEW_NO_WINDOW', 'Main window is not available');

		const view = new WebContentsView({
			webPreferences: {
				session: configurePartition(service),
				sandbox: true,
				contextIsolation: true,
				nodeIntegration: false,
				webSecurity: true,
			},
		});
		view.setVisible(false);
		view.setBackgroundColor('#00000000');
		const instance: Instance = { service, view, error: null };
		this.instances.set(instanceId, instance);
		this.wire(instanceId, instance);
		win.contentView.addChildView(view);
		// e2e runs must not depend on the network or on third-party sites being up.
		const startUrl =
			process.env['FORGE_E2E'] === '1'
				? 'data:text/html,<title>forge-e2e</title>'
				: service.url;
		void view.webContents.loadURL(startUrl).catch((error: unknown) => {
			// did-fail-load already reports this to the panel; just record it.
			wlog.warn(
				`initial load failed for ${service.id}`,
				error instanceof Error ? error.message : error,
			);
		});
		return this.stateOf(instanceId, instance);
	}

	detach(instanceId: string): void {
		const instance = this.instances.get(instanceId);
		if (!instance) return;
		this.instances.delete(instanceId);
		const win = this.getWindow();
		if (win && !win.isDestroyed()) win.contentView.removeChildView(instance.view);
		instance.view.webContents.close();
	}

	setBounds(instanceId: string, bounds: Bounds, visible: boolean): void {
		const instance = this.instances.get(instanceId);
		if (!instance) return;
		const show = visible && bounds.width > 0 && bounds.height > 0;
		if (show) instance.view.setBounds(bounds);
		instance.view.setVisible(show);
	}

	navigate(
		instanceId: string,
		action: 'back' | 'forward' | 'reload' | 'home' | 'openExternal',
	): void {
		const instance = this.instances.get(instanceId);
		if (!instance) throw new ForgeError('WEBVIEW_NOT_FOUND', 'Webview is not attached');
		const wc = instance.view.webContents;
		const history = wc.navigationHistory;
		switch (action) {
			case 'back':
				if (history.canGoBack()) history.goBack();
				break;
			case 'forward':
				if (history.canGoForward()) history.goForward();
				break;
			case 'reload':
				wc.reload();
				break;
			case 'home':
				void wc.loadURL(instance.service.url);
				break;
			case 'openExternal':
				openExternalSafely(wc.getURL());
				break;
		}
	}

	/** Test/diagnostics hook: which instances exist and whether they're visible. */
	debugState(): Array<{
		instanceId: string;
		visible: boolean;
		partition: string;
		bounds: Electron.Rectangle;
	}> {
		return [...this.instances.entries()].map(([instanceId, i]) => ({
			instanceId,
			visible: i.view.getVisible(),
			partition: i.view.webContents.session.storagePath
				? partitionFor(i.service.id)
				: 'in-memory',
			bounds: i.view.getBounds(),
		}));
	}

	destroyAll(): void {
		for (const id of [...this.instances.keys()]) this.detach(id);
	}

	private wire(instanceId: string, instance: Instance): void {
		const wc = instance.view.webContents;
		const { service } = instance;
		const emit = (): void => this.onState(this.stateOf(instanceId, instance));

		wc.setWindowOpenHandler(({ url }) => {
			// Same-site popups (e.g. TradingView's own sign-in) stay in-app on the same partition.
			if (isServiceHost(service, url)) {
				return {
					action: 'allow',
					overrideBrowserWindowOptions: {
						width: 520,
						height: 720,
						autoHideMenuBar: true,
						webPreferences: {
							session: wc.session,
							sandbox: true,
							contextIsolation: true,
							nodeIntegration: false,
						},
					},
				};
			}
			openExternalSafely(url);
			return { action: 'deny' };
		});
		wc.on('will-navigate', (event, url) => {
			if (isServiceHost(service, url)) return;
			event.preventDefault();
			openExternalSafely(url);
		});
		wc.on('will-redirect', (event, url) => {
			// Server redirects off-site (e.g. to an OAuth provider) go to the system browser.
			if (isServiceHost(service, url) || !event.isMainFrame) return;
			event.preventDefault();
			openExternalSafely(url);
		});
		wc.on('did-start-loading', () => {
			instance.error = null;
			emit();
		});
		wc.on('did-stop-loading', emit);
		wc.on('page-title-updated', emit);
		wc.on('did-navigate', emit);
		wc.on('did-navigate-in-page', emit);
		wc.on('did-fail-load', (_e, code, description, url, isMainFrame) => {
			// -3 is ERR_ABORTED: a navigation replaced by another one, not a real failure.
			if (!isMainFrame || code === -3) return;
			instance.error = `${description} (${code})`;
			wlog.warn(`load failed for ${service.id}`, {
				code,
				description,
				url: url.slice(0, 200),
			});
			emit();
		});
		wc.on('render-process-gone', (_e, details) => {
			instance.error = `Page crashed (${details.reason})`;
			wlog.error(`render process gone for ${service.id}`, details);
			emit();
		});
	}

	private stateOf(instanceId: string, instance: Instance): WebviewState {
		const wc = instance.view.webContents;
		return {
			instanceId,
			url: wc.getURL() || instance.service.url,
			title: wc.getTitle(),
			loading: wc.isLoading(),
			canGoBack: wc.navigationHistory.canGoBack(),
			error: instance.error,
		};
	}
}
