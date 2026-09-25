import { describe, expect, it } from 'vitest';

import {
	extractLinks,
	extractTags,
	formatMomentDate,
	noteTitle,
	parseFrontmatter,
	resolveLink,
} from './vault-parse';

describe('parseFrontmatter', () => {
	it('reads inline, list and single-value tags and aliases', () => {
		const text = '---\ntags: [ml, "papers"]\naliases: CNN\n---\nbody';
		const inline = parseFrontmatter(text);
		expect(inline).toMatchObject({ tags: ['ml', 'papers'], aliases: ['CNN'] });
		expect(text.slice(inline.bodyStart)).toBe('body');
		const list = parseFrontmatter(
			'---\ntitle: x\ntags:\n  - trading\n  - "#fx"\nother: 1\n---\n',
		);
		expect(list.tags).toEqual(['trading', 'fx']);
		expect(parseFrontmatter('no frontmatter').tags).toEqual([]);
		expect(parseFrontmatter('---\nunterminated').bodyStart).toBe(0);
	});
});

describe('extractTags', () => {
	it('finds inline and frontmatter tags, skipping code, headings and numbers', () => {
		const text = [
			'---',
			'tags: [ML]',
			'---',
			'# Heading',
			'Working on #ml and #trading/forex, not #2024.',
			'`#notatag` and url.com/#anchor',
			'```',
			'#include <stdio.h>',
			'```',
			'#Idea at line start',
		].join('\n');
		expect(extractTags(text)).toEqual(['ML', 'trading/forex', 'Idea']);
	});
});

describe('extractLinks', () => {
	it('collects wikilink and embed targets without heading or alias', () => {
		const text =
			'See [[Note A]], [[folder/Note B#Heading|alias]], ![[chart.png]] and `[[code]]`.';
		expect(extractLinks(text)).toEqual(['Note A', 'folder/Note B', 'chart.png']);
	});
});

describe('resolveLink', () => {
	const notes = ['Inbox.md', 'Projects/Forge.md', 'Archive/Forge.md', 'Deep/a/b/Idea.md'];

	it('matches by name, preferring the same folder, then the shortest path', () => {
		expect(resolveLink('forge', 'Archive/Old.md', notes)).toBe('Archive/Forge.md');
		expect(resolveLink('Forge', 'Inbox.md', notes)).toBe('Archive/Forge.md');
		expect(resolveLink('Idea', 'Inbox.md', notes)).toBe('Deep/a/b/Idea.md');
	});

	it('matches path-like targets by suffix and ignores .md', () => {
		expect(resolveLink('Projects/Forge.md', 'Inbox.md', notes)).toBe('Projects/Forge.md');
		expect(resolveLink('b/Idea', 'Inbox.md', notes)).toBe('Deep/a/b/Idea.md');
		expect(resolveLink('Missing', 'Inbox.md', notes)).toBeNull();
		expect(resolveLink('  ', 'Inbox.md', notes)).toBeNull();
	});
});

describe('helpers', () => {
	it('derives titles', () => {
		expect(noteTitle('Projects/Forge.md')).toBe('Forge');
	});

	it('formats moment-style daily note names', () => {
		const d = new Date(2026, 8, 5);
		expect(formatMomentDate(d, 'YYYY-MM-DD')).toBe('2026-09-05');
		expect(formatMomentDate(d, 'dddd, D MMMM YYYY')).toBe('Saturday, 5 September 2026');
		expect(formatMomentDate(d, '[Week of] MMM D')).toBe('Week of Sep 5');
	});
});
