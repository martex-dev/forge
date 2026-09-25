import { z } from 'zod';

export const NotificationLevelSchema = z.enum(['info', 'success', 'warn', 'error']);
export type NotificationLevel = z.infer<typeof NotificationLevelSchema>;

/** Where clicking the notification goes: a panel (switches to its room) with optional params. */
export const NotificationTargetSchema = z.object({
	panelId: z.string().max(100),
	params: z.record(z.string(), z.unknown()).optional(),
});
export type NotificationTarget = z.infer<typeof NotificationTargetSchema>;

export const NotificationSchema = z.object({
	id: z.string(),
	module: z.string(),
	title: z.string(),
	body: z.string(),
	level: NotificationLevelSchema,
	read: z.boolean(),
	createdAt: z.number().int(),
	target: NotificationTargetSchema.nullable(),
});
export type ForgeNotification = z.infer<typeof NotificationSchema>;

export const NewNotificationSchema = NotificationSchema.pick({
	module: true,
	title: true,
	level: true,
}).extend({
	body: z.string().default(''),
	target: NotificationTargetSchema.nullable().default(null),
});
export type NewNotification = z.input<typeof NewNotificationSchema>;
