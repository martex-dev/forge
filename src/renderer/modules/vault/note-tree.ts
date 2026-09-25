import type { NoteMeta } from '@shared/ipc/channels/vault';

export interface FolderNode {
	kind: 'folder';
	name: string;
	path: string;
	children: TreeNode[];
}
export interface NoteNode {
	kind: 'note';
	name: string;
	path: string;
	note: NoteMeta;
}
export type TreeNode = FolderNode | NoteNode;

const byName = (a: TreeNode, b: TreeNode): number =>
	a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });

/** Folders first, then notes, each sorted naturally (2 before 10), like Obsidian. */
export function buildTree(notes: readonly NoteMeta[]): FolderNode {
	const root: FolderNode = { kind: 'folder', name: '', path: '', children: [] };
	const folders = new Map<string, FolderNode>([['', root]]);
	const folderFor = (path: string): FolderNode => {
		const existing = folders.get(path);
		if (existing) return existing;
		const slash = path.lastIndexOf('/');
		const parent = folderFor(slash === -1 ? '' : path.slice(0, slash));
		const node: FolderNode = {
			kind: 'folder',
			name: path.slice(slash + 1),
			path,
			children: [],
		};
		parent.children.push(node);
		folders.set(path, node);
		return node;
	};
	for (const note of notes) {
		const slash = note.path.lastIndexOf('/');
		folderFor(slash === -1 ? '' : note.path.slice(0, slash)).children.push({
			kind: 'note',
			name: note.title,
			path: note.path,
			note,
		});
	}
	const sort = (folder: FolderNode): void => {
		folder.children.sort((a, b) =>
			a.kind === b.kind ? byName(a, b) : a.kind === 'folder' ? -1 : 1,
		);
		for (const child of folder.children) if (child.kind === 'folder') sort(child);
	};
	sort(root);
	return root;
}

/** Rows to render given which folders are expanded (depth for indentation). */
export function visibleRows(
	root: FolderNode,
	expanded: ReadonlySet<string>,
): Array<{ node: TreeNode; depth: number }> {
	const rows: Array<{ node: TreeNode; depth: number }> = [];
	const walk = (folder: FolderNode, depth: number): void => {
		for (const child of folder.children) {
			rows.push({ node: child, depth });
			if (child.kind === 'folder' && expanded.has(child.path)) walk(child, depth + 1);
		}
	};
	walk(root, 0);
	return rows;
}

/** Folders containing `path`, so opening a note can reveal it in the tree. */
export function ancestors(path: string): string[] {
	const parts = path.split('/').slice(0, -1);
	return parts.map((_, i) => parts.slice(0, i + 1).join('/'));
}
