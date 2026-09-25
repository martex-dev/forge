import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type DbHandle, openDatabase } from '../db/client';
import { SettingsRepo } from '../db/settings-repo';
import { WorkspaceService } from './workspace-service';

let handle: DbHandle;
let dir: string;

beforeEach(() => {
	handle = openDatabase(':memory:');
	dir = mkdtempSync(join(tmpdir(), 'forge-ws-'));
	mkdirSync(join(dir, 'a'));
	mkdirSync(join(dir, 'b'));
});
afterEach(() => {
	handle.close();
	rmSync(dir, { recursive: true, force: true });
});

describe('WorkspaceService', () => {
	it('opens a folder, remembers it, and tracks recents newest-first without duplicates', () => {
		const settings = new SettingsRepo(handle.db);
		const ws = new WorkspaceService(settings);
		expect(ws.info()).toEqual({ root: null, name: null, recent: [] });

		ws.open(join(dir, 'a'));
		ws.open(join(dir, 'b'));
		ws.open(join(dir, 'a'));
		expect(ws.info()).toMatchObject({ root: join(dir, 'a'), name: 'a' });
		expect(ws.info().recent).toEqual([join(dir, 'a'), join(dir, 'b')]);

		// Restart: reopens the last folder.
		expect(new WorkspaceService(settings).getRoot()).toBe(join(dir, 'a'));
	});

	it('rejects folders that do not exist', () => {
		const ws = new WorkspaceService(new SettingsRepo(handle.db));
		expect(() => ws.open(join(dir, 'missing'))).toThrow(/not found/);
	});

	it('does not reopen a folder that disappeared since last run', () => {
		const settings = new SettingsRepo(handle.db);
		new WorkspaceService(settings).open(join(dir, 'b'));
		rmSync(join(dir, 'b'), { recursive: true });
		expect(new WorkspaceService(settings).getRoot()).toBeNull();
	});

	it('notifies listeners on open/close and supports unsubscribe', () => {
		const ws = new WorkspaceService(new SettingsRepo(handle.db));
		const listener = vi.fn();
		const off = ws.onChange(listener);
		ws.open(join(dir, 'a'));
		ws.close();
		off();
		ws.open(join(dir, 'b'));
		expect(listener).toHaveBeenCalledTimes(2);
		expect(listener.mock.calls[1]?.[0]).toMatchObject({ root: null });
	});
});
