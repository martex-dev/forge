import type { z } from 'zod';

import type { EventPayload, ForgeEvent } from '@shared/ipc/contract';
import type { Channel } from '@shared/ipc/contract';
import type { ModuleManifest } from '@shared/modules/types';
import type { ForgeNotification, NewNotification } from '@shared/notifications';

import type { BackupProvider } from '../backup/backup-service';
import type { Handler } from '../ipc-router';

export interface ModuleLogger {
	info(message: string, meta?: Record<string, unknown>): void;
	warn(message: string, meta?: Record<string, unknown>): void;
	error(message: string, meta?: Record<string, unknown>): void;
}

/**
 * What a module gets when activated. Anything registered through `ipc.handle` or `onDispose`
 * is torn down automatically when the module is disabled.
 */
export interface MainModuleContext {
	manifest: ModuleManifest;
	log: ModuleLogger;
	ipc: { handle<C extends Channel>(channel: C, handler: Handler<C>): void };
	emit<E extends ForgeEvent>(event: E, payload: EventPayload<E>): void;
	onDispose(fn: () => void | Promise<void>): void;
	/** Adds a notification to the inbox (and bumps the unread badge). */
	notify(input: Omit<NewNotification, 'module'>): void;
	/** Reads a secret this module declared in its manifest. Main-only; never send it to the renderer. */
	getSecret(key: string): string | null;
	/** Saves (or with null, deletes) a declared secret; emits `secrets:changed` without the value. */
	setSecret(key: string, value: string | null): void;
	/**
	 * Include a folder under userData in backups (e.g. the journal); `flush` runs before the copy.
	 * Restores swap it in at the next start, before modules open their files.
	 */
	registerBackup(provider: BackupProvider): void;
	/** Every new notification (from any module), after it's stored. Removed on disable. */
	onNotification(listener: (notification: ForgeNotification) => void): void;
	/** Persistent, zod-validated settings, namespaced per module (`<moduleId>:<key>` in the DB). */
	settings: {
		get<S extends z.ZodType>(key: string, schema: S, fallback: z.output<S>): z.output<S>;
		set<S extends z.ZodType>(key: string, schema: S, value: z.input<S>): z.output<S>;
	};
	/** The open folder. `onChange` listeners are removed automatically when the module is disabled. */
	workspace: {
		root(): string | null;
		onChange(listener: (root: string | null) => void): void;
	};
	/** Authenticated call to the Python sidecar; throws ForgeError('SIDECAR_UNAVAILABLE') if down. */
	sidecar<T>(
		method: 'GET' | 'POST' | 'PUT' | 'DELETE',
		path: string,
		body?: unknown,
		/** Extra request headers, e.g. a secret that must not appear in a URL. */
		headers?: Record<string, string>,
	): Promise<T>;
}

export interface MainModule {
	manifest: ModuleManifest;
	activate(ctx: MainModuleContext): Promise<void> | void;
	deactivate?(): Promise<void> | void;
}
