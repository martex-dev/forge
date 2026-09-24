import { resolve } from 'node:path';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'electron-vite';
import type { Plugin } from 'vite';

import { buildCsp } from './src/main/core/csp';

function cspPlugin(): Plugin {
	let mode: 'development' | 'production' = 'production';
	return {
		name: 'forge-csp',
		configResolved(config) {
			mode = config.command === 'serve' ? 'development' : 'production';
		},
		transformIndexHtml() {
			return [
				{
					tag: 'meta',
					attrs: { 'http-equiv': 'Content-Security-Policy', content: buildCsp(mode) },
					injectTo: 'head-prepend',
				},
			];
		},
	};
}

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
		plugins: [react(), tailwindcss(), cspPlugin()],
		build: {
			rollupOptions: { input: { index: resolve(__dirname, 'src/renderer/index.html') } },
		},
	},
});
