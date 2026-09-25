import type { ITheme } from '@xterm/xterm';

import { resolveToken } from '../../lib/resolve-color';

/** xterm theme from design tokens; ANSI colours mapped to the closest semantic tokens. */
export function buildXtermTheme(): ITheme {
	const c = resolveToken;
	return {
		background: c('--bg-1'),
		foreground: c('--text-0'),
		cursor: c('--accent'),
		cursorAccent: c('--bg-1'),
		selectionBackground: c('--accent-soft'),
		black: c('--bg-3'),
		red: c('--down'),
		green: c('--up'),
		yellow: c('--warn'),
		blue: c('--info'),
		magenta: c('--accent-lab'),
		cyan: c('--accent-build'),
		white: c('--text-1'),
		brightBlack: c('--text-2'),
		brightRed: c('--down'),
		brightGreen: c('--accent-trade'),
		brightYellow: c('--accent-hub'),
		brightBlue: c('--info'),
		brightMagenta: c('--accent-lab'),
		brightCyan: c('--accent-build'),
		brightWhite: c('--text-0'),
	};
}
