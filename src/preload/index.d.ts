import type { ForgeApi } from '@shared/ipc/api';

declare global {
	interface Window {
		forge: ForgeApi;
	}
}

export {};
