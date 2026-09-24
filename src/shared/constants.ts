export const APP_NAME = 'Forge';

/**
 * Native window chrome colors. Main can't read CSS variables, so these mirror tokens.css
 * (--bg-0 and --text-1). Keep them in sync if the tokens change.
 */
export const WINDOW_CHROME = {
	background: '#07080A',
	symbol: '#A3A9B4',
	titleBarHeight: 36,
} as const;
