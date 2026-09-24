import { contextBridge } from 'electron';

contextBridge.exposeInMainWorld('forge', {});
