import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { type DbHandle, openDatabase } from '../db/client';
import { LayoutsRepo } from '../db/layouts-repo';
import { SettingsRepo } from '../db/settings-repo';
import { applyStaged, backupFolderName, BackupService } from './backup-service';

let handle: DbHandle;
let root: string;
let userData: string;
let settings: SettingsRepo;
let layouts: LayoutsRepo;

beforeEach(() => {
	handle = openDatabase(':memory:');
	root = mkdtempSync(join(tmpdir(), 'forge-backup-'));
	userData = join(root, 'userData');
	mkdirSync(join(userData, 'journal', 'images'), { recursive: true });
	writeFileSync(join(userData, 'journal', 'journal.db'), 'db-bytes');
	writeFileSync(join(userData, 'journal', 'journal.db-wal'), 'transient');
	writeFileSync(join(userData, 'journal', 'images', 'a.png'), 'png');
	settings = new SettingsRepo(handle.db);
	layouts = new LayoutsRepo(handle.db);
});
afterEach(() => {
	handle.close();
	rmSync(root, { recursive: true, force: true, maxRetries: 10 });
});

describe('BackupService', () => {
	it('names backups by local date and time', () => {
		expect(backupFolderName(new Date(2026, 8, 25, 9, 5))).toBe('forge-backup-2026-09-25-0905');
	});

	it('exports settings, layouts and flushed module folders, never secrets', async () => {
		settings.set('alerts:rules', z.array(z.string()), ['btc > 100k']);
		layouts.save('trade', { grid: 1 });
		const svc = new BackupService(userData, settings, layouts, '0.2.0');
		const flush = vi.fn();
		svc.register({ folder: 'journal', flush });
		svc.register({ folder: 'missing', flush: vi.fn() });
		const dir = await svc.exportTo(join(root, 'out'), new Date(2026, 8, 25, 9, 5));
		expect(flush).toHaveBeenCalledOnce();
		expect(readFileSync(join(dir, 'journal', 'images', 'a.png'), 'utf8')).toBe('png');
		expect(existsSync(join(dir, 'journal', 'journal.db-wal'))).toBe(false);
		const preview = svc.inspect(dir);
		expect(preview).toMatchObject({
			appVersion: '0.2.0',
			settings: 1,
			rooms: ['trade'],
			folders: ['journal'],
		});
		expect(readFileSync(join(dir, 'forge-backup.json'), 'utf8')).not.toMatch(/secret/i);
	});

	it('restores settings and layouts now, and stages folders for the next start', async () => {
		settings.set('alerts:rules', z.array(z.string()), ['from backup']);
		const svc = new BackupService(userData, settings, layouts, '0.2.0');
		svc.register({ folder: 'journal' });
		const dir = await svc.exportTo(join(root, 'out'));
		// Things change after the backup…
		settings.set('alerts:rules', z.array(z.string()), ['newer']);
		settings.set('extra', z.number(), 1);
		writeFileSync(join(userData, 'journal', 'journal.db'), 'newer-db');

		expect(svc.restore(dir)).toEqual({ restartRequired: true });
		expect(settings.get('alerts:rules', z.array(z.string()), [])).toEqual(['from backup']);
		expect(settings.get('extra', z.number(), 0)).toBe(0);
		// The live journal is untouched until the next start…
		expect(readFileSync(join(userData, 'journal', 'journal.db'), 'utf8')).toBe('newer-db');
		expect(applyStaged(userData, 42)).toEqual(['journal']);
		// …then swapped in, with the old copy kept aside.
		expect(readFileSync(join(userData, 'journal', 'journal.db'), 'utf8')).toBe('db-bytes');
		expect(
			readFileSync(join(userData, 'journal.before-restore-42', 'journal.db'), 'utf8'),
		).toBe('newer-db');
		expect(applyStaged(userData)).toEqual([]);
	});

	it('refuses folders that are not backups', () => {
		const svc = new BackupService(userData, settings, layouts, '0.2.0');
		expect(() => svc.inspect(root)).toThrow(/not a Forge backup/);
		writeFileSync(join(root, 'forge-backup.json'), '{"format":"other"}');
		expect(() => svc.inspect(root)).toThrow(/damaged or from an unknown version/);
	});
});
