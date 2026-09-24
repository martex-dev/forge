import { z } from 'zod';

export const NotificationLevelSchema = z.enum(['info', 'success', 'warn', 'error']);
export type NotificationLevel = z.infer<typeof NotificationLevelSchema>;

export const NotificationSchema = z.object({
	id: z.string(),
	module: z.string(),
	title: z.string(),
	body: z.string(),
	level: NotificationLevelSchema,
	read: z.boolean(),
	createdAt: z.number().int(),
});
export type ForgeNotification = z.infer<typeof NotificationSchema>;

export const NewNotificationSchema = NotificationSchema.pick({
	module: true,
	title: true,
	level: true,
}).extend({ body: z.string().default('') });
export type NewNotification = z.input<typeof NewNotificationSchema>;
