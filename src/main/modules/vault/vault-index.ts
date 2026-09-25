import { readdir, readFile, stat } from 'node:fs/promises';
import { join } from 'node:path';

import type { NoteMeta, SearchHit } from '@shared/ipc/channels/vault';

import { IGNORED_DIRS } from '../../core/workspace/watcher';
import { extractLinks, extractTags, noteTitle, resolveLink } from './vault-parse';

export interface IndexedNote extends NoteMeta {
	links: string[];
	/** Kept for search; vaults are text and small next to what Electron already holds. */
	text: string;
}

// A runaway folder (someone points the vault at C:\) must not freeze main.
const MAX_NOTES = 20_000;
const MAX_NOTE_BYTES = 5_000_000;
const SNIPPET = 160;

export const toMeta = ({ path, title, mtime, tags }: IndexedNote): NoteMeta => ({
	path,
	title,
	mtime,
	tags,
});

export async function readNote(root: string, path: string): Promise<IndexedNote | null> {
	const abs = join(root, ...path.split('/'));
	try {
		const info = await stat(abs);
		if (!info.isFile() || info.size > MAX_NOTE_BYTES) return null;
		const text = await readFile(abs, 'utf8');
		return {
			path,
			title: noteTitle(path),
			mtime: info.mtimeMs,
			tags: extractTags(text),
			links: extractLinks(text),
			text,
		};
	} catch {
		// Gone between listing and reading (renamed/deleted): simply not in the index.
		return null;
	}
}

/** In-memory index of a vault: titles, tags, links and text for search/backlinks. */
export class VaultIndex {
	private notes = new Map<string, IndexedNote>();
	/** lower-case title → paths, so bare [[Name]] links resolve without scanning every note. */
	private byTitle = new Map<string, string[]>();

	constructor(readonly root: string) {}

	get size(): number {
		return this.notes.size;
	}

	async build(): Promise<void> {
		const paths: string[] = [];
		const walk = async (dir: string, prefix: string): Promise<void> => {
			const entries = await readdir(dir, { withFileTypes: true });
			for (const entry of entries) {
				if (paths.length >= MAX_NOTES) return;
				// .obsidian, .trash, .git… and heavy generated folders are never notes.
				if (entry.name.startsWith('.') || IGNORED_DIRS.has(entry.name)) continue;
				const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
				if (entry.isDirectory()) await walk(join(dir, entry.name), rel);
				else if (entry.isFile() && /\.md$/i.test(entry.name)) paths.push(rel);
			}
		};
		await walk(this.root, '');
		const notes = await Promise.all(paths.map((p) => readNote(this.root, p)));
		this.notes = new Map(notes.filter((n) => n !== null).map((n) => [n.path, n]));
		this.rebuildTitles();
	}

	/** Re-reads one note after a change on disk; drops it if it no longer exists. */
	async refresh(path: string): Promise<void> {
		const note = await readNote(this.root, path);
		if (note) this.notes.set(path, note);
		else this.notes.delete(path);
		this.rebuildTitles();
	}

	set(note: IndexedNote): void {
		this.notes.set(note.path, note);
		this.rebuildTitles();
	}

	private rebuildTitles(): void {
		this.byTitle = new Map();
		for (const path of this.notes.keys()) {
			const key = noteTitle(path).toLowerCase();
			this.byTitle.set(key, [...(this.byTitle.get(key) ?? []), path]);
		}
	}

	get(path: string): IndexedNote | undefined {
		return this.notes.get(path);
	}

	list(): NoteMeta[] {
		return [...this.notes.values()].map(toMeta).sort((a, b) => a.path.localeCompare(b.path));
	}

	resolve(target: string, from: string): string | null {
		const bare = target.trim().replace(/\.md$/i, '');
		const candidates = bare.includes('/')
			? [...this.notes.keys()]
			: (this.byTitle.get(bare.toLowerCase()) ?? []);
		return resolveLink(target, from, candidates);
	}

	tags(): Array<{ tag: string; count: number }> {
		const counts = new Map<string, { tag: string; count: number }>();
		for (const note of this.notes.values()) {
			for (const tag of note.tags) {
				const key = tag.toLowerCase();
				const entry = counts.get(key) ?? { tag, count: 0 };
				entry.count += 1;
				counts.set(key, entry);
			}
		}
		return [...counts.values()].sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
	}

	backlinks(path: string): NoteMeta[] {
		const out: NoteMeta[] = [];
		for (const note of this.notes.values()) {
			if (note.path === path) continue;
			if (note.links.some((link) => this.resolve(link, note.path) === path))
				out.push(toMeta(note));
		}
		return out.sort((a, b) => b.mtime - a.mtime);
	}

	/** Every word must appear (title or body, case-insensitive). Title hits rank first. */
	search(query: string, limit = 100): SearchHit[] {
		const words = query.toLowerCase().split(/\s+/).filter(Boolean);
		if (words.length === 0) return [];
		const scored: Array<SearchHit & { score: number; mtime: number }> = [];
		for (const note of this.notes.values()) {
			const title = note.title.toLowerCase();
			const body = note.text.toLowerCase();
			if (!words.every((w) => title.includes(w) || body.includes(w))) continue;
			const titleHit = words.every((w) => title.includes(w));
			const first = words.find((w) => body.includes(w));
			let line = 0;
			let snippet = '';
			if (first) {
				const at = body.indexOf(first);
				line = body.slice(0, at).split('\n').length;
				const lineStart = note.text.lastIndexOf('\n', at - 1) + 1;
				const lineEnd = note.text.indexOf('\n', at);
				const text = note.text.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
				const offset = Math.max(0, at - lineStart - SNIPPET / 3);
				snippet = `${offset > 0 ? '…' : ''}${text.slice(offset, offset + SNIPPET).trim()}`;
			}
			scored.push({
				path: note.path,
				title: note.title,
				line,
				snippet,
				score: (titleHit ? 100 : 0) + (first ? body.split(first).length - 1 : 0),
				mtime: note.mtime,
			});
		}
		return scored
			.sort((a, b) => b.score - a.score || b.mtime - a.mtime)
			.slice(0, limit)
			.map(({ path, title, line, snippet }) => ({ path, title, line, snippet }));
	}
}
