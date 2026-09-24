import { z } from 'zod';

import { NewNotificationSchema, NotificationSchema } from '../../notifications';
import { RoomIdSchema } from '../../rooms';
import { GeneralSettingsSchema } from '../../settings';
import { defineChannels } from '../define';

/** Settings, layouts and notifications — all persisted in the app DB owned by main. */
export const dataChannels = defineChannels({
	'settings:getGeneral': { input: z.void(), output: GeneralSettingsSchema },
	'settings:updateGeneral': {
		input: GeneralSettingsSchema.partial(),
		output: GeneralSettingsSchema,
	},

	'layouts:get': { input: RoomIdSchema, output: z.unknown() },
	'layouts:save': {
		// dockview's serialized layout is opaque JSON; cap size so a bug can't bloat the DB.
		input: z.object({
			room: RoomIdSchema,
			layout: z
				.record(z.string(), z.unknown())
				.refine((v) => JSON.stringify(v).length < 1_000_000, 'Layout is too large'),
		}),
		output: z.void(),
	},
	'layouts:reset': { input: RoomIdSchema, output: z.void() },

	'notifications:list': { input: z.void(), output: z.array(NotificationSchema) },
	'notifications:unreadCount': { input: z.void(), output: z.number().int() },
	'notifications:markRead': { input: z.string(), output: z.void() },
	'notifications:markAllRead': { input: z.void(), output: z.void() },
	'notifications:add': { input: NewNotificationSchema, output: NotificationSchema },
});

export const dataEvents = {
	'settings:generalChanged': GeneralSettingsSchema,
	'notifications:changed': z.object({ unreadCount: z.number().int() }),
};
