import { type BrowserWindow, Notification } from 'electron';
import log from 'electron-log/main';

import type { ForgeNotification, NewNotification } from '@shared/notifications';

import type { NotificationsRepo } from './db/notifications-repo';
import { emitEvent } from './ipc';

export type NotificationListener = (created: ForgeNotification) => void;

export type Notifier = ((input: NewNotification) => ForgeNotification) & {
	/** Main-side listeners (e.g. forwarding to Discord). Returns an unsubscribe function. */
	subscribe(listener: NotificationListener): () => void;
};

// Windows drops toasts it can't show anyway; keep the body within what the Action Center displays.
const MAX_TOAST_BODY = 200;

/**
 * Persists a notification and tells the renderer the unread count changed. warn/error also raise
 * a Windows toast when Forge isn't the focused window (in-app toasts cover the focused case).
 */
export function createNotifier(
	repo: NotificationsRepo,
	getWindow: () => BrowserWindow | null = () => null,
): Notifier {
	// Toasts must stay referenced or their click handlers can be garbage-collected.
	const live = new Set<Notification>();

	const toast = (created: ForgeNotification): void => {
		const win = getWindow();
		if (!Notification.isSupported() || (win && win.isFocused())) return;
		const toast = new Notification({
			title: created.title,
			body: created.body.slice(0, MAX_TOAST_BODY),
			urgency: created.level === 'error' ? 'critical' : 'normal',
		});
		live.add(toast);
		const release = (): void => void live.delete(toast);
		toast.on('click', () => {
			release();
			const target = getWindow();
			if (target) {
				if (target.isMinimized()) target.restore();
				target.show();
				target.focus();
			}
			emitEvent('notifications:activated', created);
		});
		toast.on('close', release);
		toast.on('failed', (_event, error) => {
			release();
			log.warn('toast failed', { error });
		});
		toast.show();
	};

	const listeners = new Set<NotificationListener>();
	const notify = (input: NewNotification): ForgeNotification => {
		const created = repo.add(input);
		emitEvent('notifications:changed', { unreadCount: repo.unreadCount() });
		emitEvent('notifications:added', created);
		if (created.level === 'warn' || created.level === 'error') toast(created);
		for (const listener of listeners) {
			// A failing listener must not break the notification (or the other listeners).
			try {
				listener(created);
			} catch (error) {
				log.warn('notification listener failed', { error });
			}
		}
		return created;
	};
	return Object.assign(notify, {
		subscribe: (listener: NotificationListener) => {
			listeners.add(listener);
			return () => void listeners.delete(listener);
		},
	});
}
