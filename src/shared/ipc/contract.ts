import type { z } from 'zod';

import { aiChannels, aiEvents } from './channels/ai';
import { alertChannels, alertEvents } from './channels/alerts';
import { appChannels } from './channels/app';
import { calendarChannels } from './channels/calendar';
import { chartChannels } from './channels/chart';
import { dataChannels, dataEvents } from './channels/data';
import { dexChannels, dexEvents } from './channels/dex';
import { fsChannels, fsEvents } from './channels/fs';
import { gitChannels, gitEvents } from './channels/git';
import { githubChannels } from './channels/github';
import { labChannels } from './channels/lab';
import { lspChannels, lspEvents } from './channels/lsp';
import { moduleChannels, moduleEvents } from './channels/modules';
import { mt5Channels } from './channels/mt5';
import { searchChannels } from './channels/search';
import { secretChannels, secretEvents } from './channels/secrets';
import { sidecarChannels, sidecarEvents } from './channels/sidecar';
import { solanaChannels } from './channels/solana';
import { terminalChannels, terminalEvents } from './channels/terminal';
import { vaultChannels, vaultEvents } from './channels/vault';
import { vercelChannels } from './channels/vercel';
import { webviewChannels, webviewEvents } from './channels/webview';
import { workspaceChannels, workspaceEvents } from './channels/workspace';
import { defineEvents } from './define';

/**
 * The single registry of IPC channels. Each domain declares its channels in ./channels/<domain>.ts
 * and is spread in here; nothing else in the app may invent a channel name.
 */
export const ipcContract = {
	...appChannels,
	...dataChannels,
	...moduleChannels,
	...sidecarChannels,
	...secretChannels,
	...webviewChannels,
	...workspaceChannels,
	...fsChannels,
	...terminalChannels,
	...gitChannels,
	...calendarChannels,
	...dexChannels,
	...chartChannels,
	...labChannels,
	...vaultChannels,
	...searchChannels,
	...lspChannels,
	...githubChannels,
	...vercelChannels,
	...aiChannels,
	...mt5Channels,
	...solanaChannels,
	...alertChannels,
};

/** Push events main → renderer. Payloads are validated in main before sending. */
export const eventContract = defineEvents({
	...dataEvents,
	...moduleEvents,
	...sidecarEvents,
	...webviewEvents,
	...workspaceEvents,
	...fsEvents,
	...terminalEvents,
	...gitEvents,
	...dexEvents,
	...vaultEvents,
	...lspEvents,
	...secretEvents,
	...aiEvents,
	...alertEvents,
});

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
