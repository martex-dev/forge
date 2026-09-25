import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join } from 'node:path';

import Database from 'better-sqlite3';

import { type JournalEntry, JournalEntrySchema } from '@shared/ipc/channels/journal';

import { ForgeError } from '../../core/errors';

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MIME: Record<string, string> = {
	'.png': 'image/png',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
};
const EXT: Record<string, string> = {
	'image/png': 'png',
	'image/jpeg': 'jpg',
	'image/webp': 'webp',
};

/**
 * The journal's own SQLite file plus a folder of screenshots per entry. Entries are JSON documents
 * (validated on read), so the shape can grow without migrations.
 */
export class JournalStore {
	private readonly db: Database.Database;

	constructor(private readonly dir: string) {
		mkdirSync(join(dir, 'images'), { recursive: true });
		this.db = new Database(join(dir, 'journal.db'));
		this.db.pragma('journal_mode = WAL');
		this.db.exec(
			'CREATE TABLE IF NOT EXISTS entries (id TEXT PRIMARY KEY, data TEXT NOT NULL, updated_at INTEGER NOT NULL)',
		);
	}

	close(): void {
		this.db.close();
	}

	list(): JournalEntry[] {
		const rows = this.db
			.prepare('SELECT data FROM entries ORDER BY updated_at DESC')
			.all() as Array<{ data: string }>;
		return rows.flatMap((r) => {
			const parsed = JournalEntrySchema.safeParse(JSON.parse(r.data));
			return parsed.success ? [parsed.data] : [];
		});
	}

	get(id: string): JournalEntry {
		const row = this.db.prepare('SELECT data FROM entries WHERE id = ?').get(id) as
			{ data: string } | undefined;
		if (!row) throw new ForgeError('JOURNAL_NOT_FOUND', 'Journal entry not found');
		return JournalEntrySchema.parse(JSON.parse(row.data));
	}

	save(entry: JournalEntry): JournalEntry {
		// Images are owned by the image calls; a stale editor copy must not drop or add files.
		let images: string[] = [];
		try {
			images = this.get(entry.id).images;
		} catch {
			images = [];
		}
		const next = JournalEntrySchema.parse({ ...entry, images, updatedAt: Date.now() });
		this.db
			.prepare(
				'INSERT INTO entries (id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at',
			)
			.run(next.id, JSON.stringify(next), next.updatedAt);
		return next;
	}

	delete(id: string): void {
		this.db.prepare('DELETE FROM entries WHERE id = ?').run(id);
		rmSync(join(this.dir, 'images', id), { recursive: true, force: true });
	}

	addImage(entryId: string, mime: string, bytes: Buffer): JournalEntry {
		if (bytes.length > MAX_IMAGE_BYTES)
			throw new ForgeError('JOURNAL_IMAGE_TOO_LARGE', 'Screenshots are limited to 10 MB');
		const entry = this.get(entryId);
		const ext = EXT[mime];
		if (!ext) throw new ForgeError('JOURNAL_IMAGE_TYPE', 'Only PNG, JPEG and WebP images');
		const file = `${randomUUID()}.${ext}`;
		const folder = join(this.dir, 'images', entryId);
		mkdirSync(folder, { recursive: true });
		writeFileSync(join(folder, file), bytes);
		return this.writeImages(entry, [...entry.images, file]);
	}

	/** data: URL for the renderer, which can't read files itself. */
	imageDataUrl(entryId: string, file: string): string {
		const entry = this.get(entryId);
		if (!entry.images.includes(file))
			throw new ForgeError('JOURNAL_NOT_FOUND', 'Image not found');
		const bytes = readFileSync(join(this.dir, 'images', entryId, file));
		return `data:${MIME[extname(file).toLowerCase()] ?? 'image/png'};base64,${bytes.toString('base64')}`;
	}

	removeImage(entryId: string, file: string): JournalEntry {
		const entry = this.get(entryId);
		if (!entry.images.includes(file)) return entry;
		rmSync(join(this.dir, 'images', entryId, file), { force: true });
		return this.writeImages(
			entry,
			entry.images.filter((f) => f !== file),
		);
	}

	private writeImages(entry: JournalEntry, images: string[]): JournalEntry {
		const next = JournalEntrySchema.parse({ ...entry, images, updatedAt: Date.now() });
		this.db
			.prepare('UPDATE entries SET data = ?, updated_at = ? WHERE id = ?')
			.run(JSON.stringify(next), next.updatedAt, next.id);
		return next;
	}
}

export function mimeOfPath(path: string): string | null {
	return MIME[extname(path).toLowerCase()] ?? null;
}
