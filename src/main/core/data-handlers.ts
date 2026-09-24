import log from 'electron-log/main';

import { DEFAULT_GENERAL, GeneralSettingsSchema } from '@shared/settings';

import type { DbHandle } from './db/client';
import { LayoutsRepo } from './db/layouts-repo';
import { NotificationsRepo } from './db/notifications-repo';
import { SettingsRepo } from './db/settings-repo';
import { emitEvent, router } from './ipc';
import type { Notifier } from './notify';

export interface DataServices {
	settings: SettingsRepo;
	layouts: LayoutsRepo;
	notifications: NotificationsRepo;
}

export function createDataServices(handle: DbHandle): DataServices {
	return {
		settings: new SettingsRepo(handle.db, (key, issues) =>
			log.warn('[settings] stored value invalid, using default', { key, issues }),
		),
		layouts: new LayoutsRepo(handle.db),
		notifications: new NotificationsRepo(handle.db),
	};
}

export function registerDataHandlers(
	{ settings, layouts, notifications }: DataServices,
	notify: Notifier,
): void {
	const general = (): ReturnType<typeof GeneralSettingsSchema.parse> =>
		settings.get('general', GeneralSettingsSchema, DEFAULT_GENERAL);

	router.handle('settings:getGeneral', general);
	router.handle('settings:updateGeneral', (patch) => {
		const next = settings.set('general', GeneralSettingsSchema, { ...general(), ...patch });
		emitEvent('settings:generalChanged', next);
		return next;
	});

	router.handle('layouts:get', (room) => layouts.get(room));
	router.handle('layouts:save', ({ room, layout }) => layouts.save(room, layout));
	router.handle('layouts:reset', (room) => layouts.reset(room));

	const changed = (): void =>
		emitEvent('notifications:changed', { unreadCount: notifications.unreadCount() });
	router.handle('notifications:list', () => notifications.list());
	router.handle('notifications:unreadCount', () => notifications.unreadCount());
	router.handle('notifications:markRead', (id) => {
		notifications.markRead(id);
		changed();
	});
	router.handle('notifications:markAllRead', () => {
		notifications.markAllRead();
		changed();
	});
	router.handle('notifications:add', (input) => notify(input));
}
