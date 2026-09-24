import type { z } from 'zod';

import { appChannels } from './channels/app';
import { defineEvents } from './define';

/**
 * The single registry of IPC channels. Each domain declares its channels in ./channels/<domain>.ts
 * and is spread in here; nothing else in the app may invent a channel name.
 */
export const ipcContract = {
	...appChannels,
};

/** Push events main → renderer. Payloads are validated in main before sending. */
export const eventContract = defineEvents({});

export type IpcContract = typeof ipcContract;
export type Channel = keyof IpcContract;
export type ChannelInput<C extends Channel> = z.input<IpcContract[C]['input']>;
export type ChannelParsedInput<C extends Channel> = z.output<IpcContract[C]['input']>;
export type ChannelOutput<C extends Channel> = z.output<IpcContract[C]['output']>;

export type EventContract = typeof eventContract;
export type ForgeEvent = keyof EventContract;
export type EventPayload<E extends ForgeEvent> = z.output<EventContract[E]>;

export function isChannel(name: string): name is Channel {
	return Object.prototype.hasOwnProperty.call(ipcContract, name);
}
