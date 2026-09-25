import { describe, expect, it } from 'vitest';

import type { NoteMeta } from '@shared/ipc/channels/vault';

import { ancestors, buildTree, visibleRows } from './note-tree';

const note = (path: string): NoteMeta => ({
	path,
	title: path.slice(path.lastIndexOf('/') + 1, -3),
	mtime: 0,
	tags: [],
});

describe('buildTree / visibleRows', () => {
	const tree = buildTree(
		[
			'Inbox.md',
			'Projects/Forge.md',
			'Daily/2026-09-10.md',
			'Daily/2026-09-9.md',
			'Projects/Sub/Deep.md',
			'a.md',
		].map(note),
	);

	it('puts folders first and sorts naturally', () => {
		expect(visibleRows(tree, new Set()).map((r) => r.node.name)).toEqual([
			'Daily',
			'Projects',
			'a',
			'Inbox',
		]);
	});

	it('expands folders with depth', () => {
		const rows = visibleRows(tree, new Set(['Daily', 'Projects', 'Projects/Sub']));
		expect(rows.map((r) => `${r.depth}:${r.node.name}`)).toEqual([
			'0:Daily',
			'1:2026-09-9',
			'1:2026-09-10',
			'0:Projects',
			'1:Sub',
			'2:Deep',
			'1:Forge',
			'0:a',
			'0:Inbox',
		]);
	});
});

describe('ancestors', () => {
	it('lists containing folders outermost first', () => {
		expect(ancestors('Projects/Sub/Deep.md')).toEqual(['Projects', 'Projects/Sub']);
		expect(ancestors('Inbox.md')).toEqual([]);
	});
});
