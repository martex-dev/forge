/**
 * Monaco only understands #rrggbb(aa) colors, but our tokens use var() and color-mix().
 * Paint the token into a 1×1 canvas and read the resulting pixel back.
 */
function resolveToken(token: string): string {
	const probe = document.createElement('span');
	probe.style.color = `var(${token})`;
	document.body.appendChild(probe);
	const computed = getComputedStyle(probe).color;
	probe.remove();

	const canvas = document.createElement('canvas');
	canvas.width = 1;
	canvas.height = 1;
	const ctx = canvas.getContext('2d', { willReadFrequently: true });
	if (!ctx) return computed;
	ctx.clearRect(0, 0, 1, 1);
	ctx.fillStyle = computed;
	ctx.fillRect(0, 0, 1, 1);
	const [r = 0, g = 0, b = 0, a = 255] = ctx.getImageData(0, 0, 1, 1).data;
	const hex = (n: number): string => n.toString(16).padStart(2, '0');
	return `#${hex(r)}${hex(g)}${hex(b)}${a === 255 ? '' : hex(a)}`;
}

/** VS Code user settings (JSON) that restyle "Default Dark Modern" with Forge's tokens. */
export function buildUserConfiguration(fontSize: number, reduceMotion: boolean): string {
	const c = (token: string): string => resolveToken(token);
	const colors = {
		'editor.background': c('--bg-1'),
		'editor.foreground': c('--text-0'),
		'editorGutter.background': c('--bg-1'),
		'editorLineNumber.foreground': c('--text-2'),
		'editorLineNumber.activeForeground': c('--text-1'),
		'editorCursor.foreground': c('--accent'),
		'editor.lineHighlightBackground': c('--bg-2'),
		'editor.lineHighlightBorder': c('--bg-2'),
		'editor.selectionBackground': c('--accent-soft'),
		'editor.inactiveSelectionBackground': c('--bg-3'),
		'editorIndentGuide.background1': c('--border'),
		'editorIndentGuide.activeBackground1': c('--border-strong'),
		'editorWidget.background': c('--bg-2'),
		'editorWidget.border': c('--border-strong'),
		'editorSuggestWidget.background': c('--bg-2'),
		'editorSuggestWidget.selectedBackground': c('--bg-3'),
		'editorHoverWidget.background': c('--bg-2'),
		'editorHoverWidget.border': c('--border-strong'),
		'minimap.background': c('--bg-1'),
		'scrollbarSlider.background': c('--bg-3'),
		'scrollbarSlider.hoverBackground': c('--border-strong'),
		focusBorder: c('--accent'),
		'editorError.foreground': c('--down'),
		'editorWarning.foreground': c('--warn'),
		'editorInfo.foreground': c('--info'),
	};
	return JSON.stringify({
		'workbench.colorTheme': 'Default Dark Modern',
		'workbench.colorCustomizations': colors,
		'editor.fontFamily': "'JetBrains Mono', ui-monospace, monospace",
		'editor.fontSize': fontSize,
		'editor.lineHeight': Math.round(fontSize * 1.6),
		'editor.fontLigatures': false,
		'editor.minimap.enabled': true,
		'editor.minimap.renderCharacters': false,
		'editor.renderWhitespace': 'selection',
		'editor.bracketPairColorization.enabled': true,
		'editor.guides.bracketPairs': 'active',
		'editor.stickyScroll.enabled': true,
		'editor.smoothScrolling': !reduceMotion,
		'editor.cursorBlinking': reduceMotion ? 'solid' : 'smooth',
		'editor.cursorSmoothCaretAnimation': reduceMotion ? 'off' : 'on',
		'editor.scrollBeyondLastLine': false,
		'editor.padding.top': 8,
	});
}
