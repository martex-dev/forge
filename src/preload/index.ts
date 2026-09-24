import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import { type EventEnvelope, type ForgeApi, TRANSPORT } from '@shared/ipc/api';

// Kept deliberately thin: no validation or logic here, main validates everything.
const api: ForgeApi = {
	invoke: (channel, ...args) => ipcRenderer.invoke(TRANSPORT.invoke, { channel, input: args[0] }),
	on: (event, handler) => {
		const listener = (_e: IpcRendererEvent, envelope: EventEnvelope): void => {
			if (envelope.event === event) handler(envelope.payload as never);
		};
		ipcRenderer.on(TRANSPORT.event, listener);
		return () => {
			ipcRenderer.removeListener(TRANSPORT.event, listener);
		};
	},
	platform: process.platform,
};

contextBridge.exposeInMainWorld('forge', api);
