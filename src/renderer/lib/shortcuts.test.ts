import { describe, expect, it } from 'vitest';

import { matchesShortcut, parseShortcut } from './shortcuts';

const ev = (
	key: string,
	mods: Partial<{ ctrl: boolean; shift: boolean; alt: boolean }> = {},
	code?: string,
) => ({
	key,
	...(code ? { code } : {}),
	ctrlKey: mods.ctrl ?? false,
	shiftKey: mods.shift ?? false,
	altKey: mods.alt ?? false,
});

describe('shortcuts', () => {
	it('parses modifiers and key', () => {
		expect(parseShortcut('Ctrl+Shift+P')).toEqual({
			ctrl: true,
			shift: true,
			alt: false,
			key: 'p',
		});
	});

	it('matches exact modifier combos only', () => {
		expect(matchesShortcut(ev('k', { ctrl: true }), 'Ctrl+K')).toBe(true);
		expect(matchesShortcut(ev('K', { ctrl: true, shift: true }), 'Ctrl+K')).toBe(false);
		expect(matchesShortcut(ev('P', { ctrl: true, shift: true }), 'Ctrl+Shift+P')).toBe(true);
		expect(matchesShortcut(ev('k'), 'Ctrl+K')).toBe(false);
	});

	it('uses the physical key code when shift alters the character', () => {
		expect(
			matchesShortcut(ev('!', { ctrl: true, shift: true }, 'Digit1'), 'Ctrl+Shift+1'),
		).toBe(true);
		expect(matchesShortcut(ev('2', { ctrl: true }, 'Digit2'), 'Ctrl+2')).toBe(true);
		expect(matchesShortcut(ev(',', { ctrl: true }, 'Comma'), 'Ctrl+,')).toBe(true);
		expect(
			matchesShortcut(ev('~', { ctrl: true, shift: true }, 'Backquote'), 'Ctrl+Shift+`'),
		).toBe(true);
	});
});
