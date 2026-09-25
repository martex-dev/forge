import { describe, expect, it } from 'vitest';

import { parsePatch } from './patch';

describe('parsePatch', () => {
	it('numbers old and new lines across hunks', () => {
		const lines = parsePatch(
			[
				'@@ -1,3 +1,4 @@ def main():',
				' import os',
				'-x = 1',
				'+x = 2',
				'+y = 3',
				' print(x)',
				'@@ -20 +21 @@',
				'-old',
				'+new',
				'\\ No newline at end of file',
			].join('\n'),
		);
		expect(lines.map((l) => [l.kind, l.oldLine, l.newLine, l.text])).toEqual([
			['hunk', null, null, '@@ -1,3 +1,4 @@ def main():'],
			['ctx', 1, 1, 'import os'],
			['del', 2, null, 'x = 1'],
			['add', null, 2, 'x = 2'],
			['add', null, 3, 'y = 3'],
			['ctx', 3, 4, 'print(x)'],
			['hunk', null, null, '@@ -20 +21 @@'],
			['del', 20, null, 'old'],
			['add', null, 21, 'new'],
			['meta', null, null, '\\ No newline at end of file'],
		]);
	});

	it('drops the empty line a trailing newline would create', () => {
		expect(parsePatch('@@ -1 +1 @@\n-a\n+b\n').map((l) => l.kind)).toEqual([
			'hunk',
			'del',
			'add',
		]);
	});
});
