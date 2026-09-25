import { existsSync, statSync } from 'node:fs';
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, join, relative, sep } from 'node:path';

import { type FSWatcher, watch } from 'chokidar';

import type { VaultInfo } from '@shared/ipc/channels/vault';

import { ForgeError } from '../../core/errors';
import { assertRealInside, toAbsolute, validateName } from '../../core/workspace/fs-guard';
import { IGNORED_DIRS } from '../../core/workspace/watcher';
import { readNote, VaultIndex } from './vault-index';
import { formatMomentDate } from './vault-parse';

const WATCH_DEBOUNCE_MS = 250;
const pad = (n: number): string => String(n).padStart(2, '0');

export interface VaultEvents {
	changed(paths: string[], full: boolean): void;
	error(message: string, error: unknown): void;
}

/** The chosen vault: path guard, index, watcher and note writes. */
export class VaultService {
	private index: VaultIndex | null = null;
	private watcher: FSWatcher | null = null;
	private pending = new Set<string>();
	private timer: ReturnType<typeof setTimeout> | undefined;

	constructor(
		private readonly events: VaultEvents,
		// Unit tests turn this off: chokidar handles on a temp folder crash vitest's worker at
		// teardown on Windows (plain Node and Electron are fine; e2e covers the watcher).
		private readonly watchFiles = true,
	) {}

	get root(): string | null {
		return this.index?.root ?? null;
	}

	info(): VaultInfo {
		const root = this.root;
		return {
			root,
			name: root ? basename(root) : null,
			noteCount: this.index?.size ?? 0,
			isObsidian: root ? existsSync(join(root, '.obsidian')) : false,
		};
	}

	requireIndex(): VaultIndex {
		if (!this.index) throw new ForgeError('VAULT_NONE', 'No vault is open');
		return this.index;
	}

	async open(root: string | null): Promise<VaultInfo> {
		await this.close();
		if (root) {
			if (!existsSync(root) || !statSync(root).isDirectory()) {
				throw new ForgeError('VAULT_NOT_FOUND', `Folder not found: ${root}`);
			}
			const index = new VaultIndex(root);
			await index.build();
			this.index = index;
			if (this.watchFiles) this.startWatching(root);
		}
		this.events.changed([], true);
		return this.info();
	}

	async close(): Promise<void> {
		clearTimeout(this.timer);
		this.pending.clear();
		const watcher = this.watcher;
		this.watcher = null;
		this.index = null;
		await watcher?.close();
	}

	/** Absolute path of a vault note, refusing anything that escapes the vault (.., junctions). */
	private resolvePath(path: string): string {
		const root = this.requireIndex().root;
		const abs = toAbsolute(root, path);
		assertRealInside(root, abs);
		return abs;
	}

	async read(path: string): Promise<{ content: string; mtime: number }> {
		const abs = this.resolvePath(path);
		try {
			const [content, info] = await Promise.all([readFile(abs, 'utf8'), stat(abs)]);
			return { content, mtime: info.mtimeMs };
		} catch (error) {
			throw new ForgeError('VAULT_READ_FAILED', `Could not read ${path}`, error);
		}
	}

	async write(path: string, content: string, baseMtime: number | null): Promise<number> {
		const abs = this.resolvePath(path);
		if (baseMtime !== null) {
			const current = await stat(abs).catch(() => null);
			// Obsidian (or sync) changed the file since we loaded it: don't silently clobber it.
			if (current && Math.abs(current.mtimeMs - baseMtime) > 1) {
				throw new ForgeError(
					'VAULT_CONFLICT',
					`${path} changed on disk since it was opened`,
				);
			}
		}
		await mkdir(dirname(abs), { recursive: true });
		await writeFile(abs, content, 'utf8');
		const note = await readNote(this.requireIndex().root, path);
		if (note) this.index?.set(note);
		return note?.mtime ?? Date.now();
	}

	async create(folder: string, name: string): Promise<string> {
		const file = /\.md$/i.test(name) ? name : `${name}.md`;
		validateName(file);
		const path = folder ? `${folder.replace(/\/+$/, '')}/${file}` : file;
		const abs = this.resolvePath(path);
		if (existsSync(abs)) throw new ForgeError('VAULT_EXISTS', `${path} already exists`);
		await this.write(path, '', null);
		return path;
	}

	/** Obsidian's daily-note settings (folder + moment format), or its defaults. */
	private async dailyNotePath(now: Date): Promise<string> {
		const root = this.requireIndex().root;
		let folder = '';
		let format = 'YYYY-MM-DD';
		try {
			const raw: unknown = JSON.parse(
				await readFile(join(root, '.obsidian', 'daily-notes.json'), 'utf8'),
			);
			if (raw && typeof raw === 'object') {
				const cfg = raw as { folder?: unknown; format?: unknown };
				if (typeof cfg.folder === 'string') folder = cfg.folder.replace(/^\/+|\/+$/g, '');
				if (typeof cfg.format === 'string' && cfg.format.trim()) format = cfg.format.trim();
			}
		} catch {
			// No daily-notes plugin config: Obsidian's defaults apply.
		}
		const name = `${formatMomentDate(now, format)}.md`;
		return folder ? `${folder}/${name}` : name;
	}

	async quickNote(text: string, now = new Date()): Promise<string> {
		const path = await this.dailyNotePath(now);
		const abs = this.resolvePath(path);
		const existing = await readFile(abs, 'utf8').catch(() => '');
		const bullet = `- ${pad(now.getHours())}:${pad(now.getMinutes())} ${text.replace(/\r?\n/g, '\n  ')}`;
		const sepLine = existing && !existing.endsWith('\n') ? '\n' : '';
		await this.write(path, `${existing}${sepLine}${bullet}\n`, null);
		return path;
	}

	private startWatching(root: string): void {
		this.watcher = watch(root, {
			ignoreInitial: true,
			ignored: (abs: string) => {
				const rel = relative(root, abs);
				return rel
					.split(sep)
					.some((part) => part.startsWith('.') || IGNORED_DIRS.has(part));
			},
			awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
		});
		const queue = (abs: string): void => {
			if (!/\.md$/i.test(abs)) return;
			this.pending.add(relative(root, abs).split(sep).join('/'));
			clearTimeout(this.timer);
			this.timer = setTimeout(() => void this.flush(), WATCH_DEBOUNCE_MS);
		};
		this.watcher
			.on('add', queue)
			.on('change', queue)
			.on('unlink', queue)
			// A folder rename/move touches many notes: cheaper to rebuild than to diff.
			.on('unlinkDir', () => void this.rebuild())
			.on('error', (error) => this.events.error('vault watcher error', error));
	}

	private async flush(): Promise<void> {
		const index = this.index;
		const paths = [...this.pending];
		this.pending.clear();
		if (!index || paths.length === 0) return;
		await Promise.all(paths.map((p) => index.refresh(p)));
		this.events.changed(paths, false);
	}

	private async rebuild(): Promise<void> {
		const index = this.index;
		if (!index) return;
		try {
			await index.build();
			this.events.changed([], true);
		} catch (error) {
			this.events.error('vault rebuild failed', error);
		}
	}
}
