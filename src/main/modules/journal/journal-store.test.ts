import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { JournalEntry } from '@shared/ipc/channels/journal';

import { JournalStore } from './journal-store';

let dir: string;
let store: JournalStore;

const entry = (id: string, extra: Partial<JournalEntry> = {}): JournalEntry => ({
	id,
	symbol: 'EURUSD',
	market: 'forex',
	side: 'long',
	status: 'closed',
	entry: 1.08,
	exit: 1.085,
	size: 10_000,
	stop: 1.078,
	target: null,
	pnl: null,
	fees: 0,
	openedAt: 1,
	closedAt: 2,
	setup: 'breakout',
	tags: ['london'],
	notes: '',
	images: [],
	createdAt: 1,
	updatedAt: 1,
	...extra,
});
const ID = '11111111-1111-4111-8111-111111111111';
// 1×1 transparent PNG.
const PNG = Buffer.from(
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
	'base64',
);

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'forge-journal-'));
	store = new JournalStore(dir);
});
afterEach(() => {
	store.close();
	rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
});

describe('JournalStore', () => {
	it('saves, lists newest first and deletes', () => {
		store.save(entry(ID));
		store.save(entry('22222222-2222-4222-8222-222222222222', { symbol: 'XAUUSD' }));
		expect(store.list().map((e) => e.symbol)).toEqual(['XAUUSD', 'EURUSD']);
		store.delete(ID);
		expect(store.list().map((e) => e.symbol)).toEqual(['XAUUSD']);
	});

	it('manages screenshots independently of the editor copy', () => {
		store.save(entry(ID));
		const withImage = store.addImage(ID, 'image/png', PNG);
		const [file] = withImage.images;
		expect(file).toMatch(/\.png$/);
		expect(store.imageDataUrl(ID, file ?? '')).toMatch(/^data:image\/png;base64,iVBOR/);
		// Saving an editor copy without images must not drop them.
		store.save(entry(ID, { notes: 'edited' }));
		expect(store.get(ID).images).toEqual([file]);
		expect(store.removeImage(ID, file ?? '').images).toEqual([]);
		expect(() => store.imageDataUrl(ID, file ?? '')).toThrow(/not found/);
	});

	it('rejects oversized and unknown images', () => {
		store.save(entry(ID));
		expect(() => store.addImage(ID, 'image/gif', PNG)).toThrow(/PNG, JPEG and WebP/);
		expect(() => store.addImage(ID, 'image/png', Buffer.alloc(11 * 1024 * 1024))).toThrow(
			/10 MB/,
		);
	});
});
