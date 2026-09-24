import type { EventPayload, ForgeEvent } from '@shared/ipc/contract';
import type { Channel } from '@shared/ipc/contract';
import type { ModuleManifest } from '@shared/modules/types';

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
}

export interface MainModule {
	manifest: ModuleManifest;
	activate(ctx: MainModuleContext): Promise<void> | void;
	deactivate?(): Promise<void> | void;
}
