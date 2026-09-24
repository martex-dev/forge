import { resolve } from 'node:path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';

const alias = {
	'@main': resolve(__dirname, 'src/main'),
	'@renderer': resolve(__dirname, 'src/renderer'),
	'@shared': resolve(__dirname, 'src/shared'),
};

export default defineConfig({
	main: {
		resolve: { alias },
		build: {
			rollupOptions: { input: { index: resolve(__dirname, 'src/main/index.ts') } },
		},
	},
	preload: {
		resolve: { alias },
		build: {
			// Sandboxed preloads can only require('electron'), so everything else must be bundled.
			externalizeDeps: false,
			rollupOptions: { input: { index: resolve(__dirname, 'src/preload/index.ts') } },
		},
	},
	renderer: {
		root: resolve(__dirname, 'src/renderer'),
		resolve: { alias },
		plugins: [react()],
		build: {
			rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } },
		},
	},
});
