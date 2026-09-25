export interface ParsedShortcut {
	ctrl: boolean;
	shift: boolean;
	alt: boolean;
	key: string;
}

/** Parses "Ctrl+Shift+P" style strings. Keys are compared lower-case. */
export function parseShortcut(shortcut: string): ParsedShortcut {
	const parts = shortcut.split('+').map((p) => p.trim().toLowerCase());
	const key = parts[parts.length - 1] ?? '';
	return {
		ctrl: parts.includes('ctrl'),
		shift: parts.includes('shift'),
		alt: parts.includes('alt'),
		key,
	};
}

interface KeyLike {
	key: string;
	code?: string;
	ctrlKey: boolean;
	metaKey?: boolean;
	shiftKey: boolean;
	altKey: boolean;
}

export function matchesShortcut(event: KeyLike, shortcut: string): boolean {
	const s = parseShortcut(shortcut);
	const ctrl = event.ctrlKey || Boolean(event.metaKey);
	if (ctrl !== s.ctrl || event.shiftKey !== s.shift || event.altKey !== s.alt) return false;
	// Shift changes `key` for digits/punctuation ("!" for 1), so fall back to the physical code.
	const key = event.key.toLowerCase();
	if (key === s.key) return true;
	if (event.code) {
		const code = event.code.toLowerCase();
		return (
			code === `key${s.key}` ||
			code === `digit${s.key}` ||
			(s.key === '`' && code === 'backquote') ||
			(s.key === ',' && code === 'comma')
		);
	}
	return false;
}
