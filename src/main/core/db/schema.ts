import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/** Key/value settings; values are JSON validated by zod in SettingsService. */
export const settings = sqliteTable('settings', {
	key: text('key').primaryKey(),
	value: text('value', { mode: 'json' }).notNull(),
});

/** One serialized dockview layout per room. */
export const layouts = sqliteTable('layouts', {
	room: text('room').primaryKey(),
	layout: text('layout', { mode: 'json' }).notNull(),
	updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull(),
});

export const notifications = sqliteTable('notifications', {
	id: text('id').primaryKey(),
	module: text('module').notNull(),
	title: text('title').notNull(),
	body: text('body').notNull().default(''),
	level: text('level', { enum: ['info', 'success', 'warn', 'error'] }).notNull(),
	read: integer('read', { mode: 'boolean' }).notNull().default(false),
	createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull(),
	/** NotificationTarget as JSON, validated on read. */
	target: text('target', { mode: 'json' }),
});
