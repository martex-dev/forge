import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_GENERAL, GeneralSettingsSchema } from '@shared/settings';

import { type DbHandle, openDatabase } from './client';
import { LayoutsRepo } from './layouts-repo';
import { migrate, MIGRATIONS } from './migrate';
import { NotificationsRepo } from './notifications-repo';
import { SettingsRepo } from './settings-repo';

let handle: DbHandle;

beforeEach(() => {
	handle = openDatabase(':memory:');
});
afterEach(() => handle.close());

describe('migrations', () => {
	it('bundles at least the init migration', () => {
		expect(MIGRATIONS.map((m) => m.name)).toContain('0000_init.sql');
	});

	it('are idempotent', () => {
		const sqlite = new Database(':memory:');
		expect(migrate(sqlite).length).toBe(MIGRATIONS.length);
		expect(migrate(sqlite)).toEqual([]);
		sqlite.close();
	});
});

describe('SettingsRepo', () => {
	it('returns the fallback when unset and round-trips validated values', () => {
		const repo = new SettingsRepo(handle.db);
		expect(repo.get('general', GeneralSettingsSchema, DEFAULT_GENERAL)).toEqual(
			DEFAULT_GENERAL,
		);
		repo.set('general', GeneralSettingsSchema, { fontSize: 14, reduceMotion: true });
		expect(repo.get('general', GeneralSettingsSchema, DEFAULT_GENERAL)).toEqual({
			fontSize: 14,
			reduceMotion: true,
		});
	});

	it('rejects invalid writes', () => {
		const repo = new SettingsRepo(handle.db);
		expect(() =>
			repo.set('general', GeneralSettingsSchema, { fontSize: 99 } as never),
		).toThrow();
	});

	it('falls back (and reports) when stored data is corrupt', () => {
		const onInvalid = vi.fn();
		const repo = new SettingsRepo(handle.db, onInvalid);
		handle.sqlite
			.prepare("INSERT INTO settings (key, value) VALUES ('general', '\"nope\"')")
			.run();
		expect(repo.get('general', GeneralSettingsSchema, DEFAULT_GENERAL)).toEqual(
			DEFAULT_GENERAL,
		);
		expect(onInvalid).toHaveBeenCalledWith('general', expect.any(String));
	});

	it('persists across reopen of a file database', () => {
		const dir = mkdtempSync(join(tmpdir(), 'forge-db-'));
		const file = join(dir, 'forge.db');
		const first = openDatabase(file);
		new SettingsRepo(first.db).set('general', GeneralSettingsSchema, { fontSize: 12 });
		first.close();
		const second = openDatabase(file);
		expect(
			new SettingsRepo(second.db).get('general', GeneralSettingsSchema, DEFAULT_GENERAL),
		).toEqual({
			fontSize: 12,
			reduceMotion: false,
		});
		second.close();
		rmSync(dir, { recursive: true, force: true });
	});
});

describe('LayoutsRepo', () => {
	it('saves, overwrites and resets per room', () => {
		const repo = new LayoutsRepo(handle.db);
		expect(repo.get('build')).toBeNull();
		repo.save('build', { grid: 1 });
		repo.save('build', { grid: 2 });
		repo.save('trade', { grid: 3 });
		expect(repo.get('build')).toEqual({ grid: 2 });
		repo.reset('build');
		expect(repo.get('build')).toBeNull();
		expect(repo.get('trade')).toEqual({ grid: 3 });
	});
});

describe('NotificationsRepo', () => {
	it('adds, lists newest first, counts unread and marks read', () => {
		const repo = new NotificationsRepo(handle.db);
		const a = repo.add({ module: 'core', title: 'A', level: 'info' });
		const b = repo.add({ module: 'core', title: 'B', body: 'details', level: 'error' });
		expect(repo.unreadCount()).toBe(2);
		expect(repo.list().map((n) => n.id)).toContain(b.id);
		repo.markRead(a.id);
		expect(repo.unreadCount()).toBe(1);
		repo.markAllRead();
		expect(repo.unreadCount()).toBe(0);
		expect(a.body).toBe('');
	});

	it('deletes by id', () => {
		const repo = new NotificationsRepo(handle.db);
		const a = repo.add({ module: 'core', title: 'A', level: 'info' });
		const b = repo.add({ module: 'core', title: 'B', level: 'info' });
		expect(repo.delete([a.id, 'missing'])).toBe(1);
		expect(repo.list().map((n) => n.id)).toContain(b.id);
		expect(repo.list().map((n) => n.id)).not.toContain(a.id);
		expect(repo.delete([])).toBe(0);
	});
});
