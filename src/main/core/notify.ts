import type { ForgeNotification, NewNotification } from '@shared/notifications';

import type { NotificationsRepo } from './db/notifications-repo';
import { emitEvent } from './ipc';

export type Notifier = (input: NewNotification) => ForgeNotification;

/** Persists a notification and tells the renderer the unread count changed. */
export function createNotifier(repo: NotificationsRepo): Notifier {
	return (input) => {
		const created = repo.add(input);
		emitEvent('notifications:changed', { unreadCount: repo.unreadCount() });
		return created;
	};
}
