import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

import { describe, expect, it } from 'vitest';

const RENDERER = join(__dirname, '..', 'src', 'renderer');
const ALLOWED = new Set(['styles/tokens.css']);
const COLOR = /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/;

function walk(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		return statSync(full).isDirectory() ? walk(full) : [full];
	});
}

describe('design tokens', () => {
	it('no hardcoded colors outside tokens.css', () => {
		const offenders = walk(RENDERER)
			.filter((f) => /\.(tsx?|css)$/.test(f) && !f.endsWith('.test.ts'))
			.map((f) => relative(RENDERER, f).split('\\').join('/'))
			.filter((rel) => !ALLOWED.has(rel))
			.flatMap((rel) =>
				readFileSync(join(RENDERER, rel), 'utf8')
					.split('\n')
					.map((line, i) => ({ rel, line: i + 1, text: line }))
					.filter(({ text }) => COLOR.test(text)),
			)
			.map(({ rel, line, text }) => `${rel}:${line}: ${text.trim()}`);

		expect(offenders).toEqual([]);
	});
});
