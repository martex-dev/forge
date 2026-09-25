import { randomUUID } from 'node:crypto';

import { count, desc, eq } from 'drizzle-orm';

import {
	type ForgeNotification,
	type NewNotification,
	NewNotificationSchema,
	NotificationTargetSchema,
} from '@shared/notifications';

import type { Db } from './client';
import { notifications } from './schema';

type Row = typeof notifications.$inferSelect;

function toDto(row: Row): ForgeNotification {
	// A target written by an older/newer build that no longer validates just isn't clickable.
	const target = NotificationTargetSchema.safeParse(row.target);
	return {
		...row,
		createdAt: row.createdAt.getTime(),
		target: target.success ? target.data : null,
	};
}

export class NotificationsRepo {
	constructor(private readonly db: Db) {}

	add(input: NewNotification): ForgeNotification {
		const parsed = NewNotificationSchema.parse(input);
		const row = this.db
			.insert(notifications)
			.values({ ...parsed, id: randomUUID(), read: false, createdAt: new Date() })
			.returning()
			.get();
		return toDto(row);
	}

	list(limit = 200): ForgeNotification[] {
		return this.db
			.select()
			.from(notifications)
			.orderBy(desc(notifications.createdAt))
			.limit(limit)
			.all()
			.map(toDto);
	}

	markRead(id: string): void {
		this.db.update(notifications).set({ read: true }).where(eq(notifications.id, id)).run();
	}

	markAllRead(): void {
		this.db.update(notifications).set({ read: true }).run();
	}

	deleteRead(): number {
		return this.db.delete(notifications).where(eq(notifications.read, true)).run().changes;
	}

	unreadCount(): number {
		return (
			this.db
				.select({ n: count() })
				.from(notifications)
				.where(eq(notifications.read, false))
				.get()?.n ?? 0
		);
	}
}
