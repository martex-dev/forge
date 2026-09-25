import { mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { VaultService } from './vault-service';

let root: string;
let service: VaultService;
const changes: Array<{ paths: string[]; full: boolean }> = [];

function write(rel: string, text: string): void {
	const abs = join(root, ...rel.split('/'));
	mkdirSync(join(abs, '..'), { recursive: true });
	writeFileSync(abs, text);
}

beforeEach(async () => {
	root = mkdtempSync(join(tmpdir(), 'forge-vault-'));
	write('Inbox.md', 'Links to [[Forge]] and #idea');
	write('Projects/Forge.md', '---\ntags: [project]\n---\n# Forge\nElectron app, see [[Inbox]].');
	write('Projects/Trading.md', 'Forex journal #trading #idea');
	write('.obsidian/app.json', '{}');
	write('.trash/Old.md', 'deleted');
	write('node_modules/x/readme.md', 'noise');
	changes.length = 0;
	service = new VaultService(
		{ changed: (paths, full) => changes.push({ paths, full }), error: () => undefined },
		false,
	);
	await service.open(root);
});

afterEach(async () => {
	await service.close();
	rmSync(root, { recursive: true, force: true, maxRetries: 5 });
});

describe('VaultService', () => {
	it('indexes notes only (no dot folders or node_modules) and reports Obsidian vaults', () => {
		expect(
			service
				.requireIndex()
				.list()
				.map((n) => n.path),
		).toEqual(['Inbox.md', 'Projects/Forge.md', 'Projects/Trading.md']);
		expect(service.info()).toMatchObject({ noteCount: 3, isObsidian: true });
		expect(changes).toEqual([{ paths: [], full: true }]);
	});

	it('answers tags, backlinks, resolution and search', () => {
		const index = service.requireIndex();
		expect(index.tags()).toEqual([
			{ tag: 'idea', count: 2 },
			{ tag: 'project', count: 1 },
			{ tag: 'trading', count: 1 },
		]);
		expect(index.backlinks('Projects/Forge.md').map((n) => n.path)).toEqual(['Inbox.md']);
		expect(index.resolve('forge', 'Inbox.md')).toBe('Projects/Forge.md');
		const hits = index.search('forex journal');
		expect(hits).toEqual([
			{
				path: 'Projects/Trading.md',
				title: 'Trading',
				line: 1,
				snippet: 'Forex journal #trading #idea',
			},
		]);
		expect(index.search('forge')[0]?.path).toBe('Projects/Forge.md'); // title match first
	});

	it('writes with conflict detection and keeps the index current', async () => {
		const { content, mtime } = await service.read('Inbox.md');
		expect(content).toContain('[[Forge]]');
		const saved = await service.write('Inbox.md', 'Now about #cooking', mtime);
		expect(service.requireIndex().get('Inbox.md')?.tags).toEqual(['cooking']);

		// Someone else (Obsidian, sync) writes after we loaded: refuse to clobber.
		utimesSync(join(root, 'Inbox.md'), new Date(), new Date(saved + 60_000));
		await expect(service.write('Inbox.md', 'mine', saved)).rejects.toMatchObject({
			code: 'VAULT_CONFLICT',
		});
	});

	it('creates notes and refuses paths outside the vault', async () => {
		expect(await service.create('Projects', 'New idea')).toBe('Projects/New idea.md');
		await expect(service.create('', 'New idea')).resolves.toBe('New idea.md');
		await expect(service.create('Projects', 'New idea')).rejects.toMatchObject({
			code: 'VAULT_EXISTS',
		});
		await expect(service.read('../outside.md')).rejects.toMatchObject({
			code: 'FS_OUTSIDE_WORKSPACE',
		});
		await expect(service.create('', 'bad:name')).rejects.toThrow(/characters/);
	});

	it('appends quick notes to the daily note from Obsidian settings', async () => {
		write(
			'.obsidian/daily-notes.json',
			JSON.stringify({ folder: 'Daily/', format: 'YYYY-MM-DD' }),
		);
		const at = new Date(2026, 8, 25, 9, 5);
		const path = await service.quickNote('Buy the dip?', at);
		expect(path).toBe('Daily/2026-09-25.md');
		await service.quickNote('two\nlines', new Date(2026, 8, 25, 14, 30));
		expect(readFileSync(join(root, 'Daily', '2026-09-25.md'), 'utf8')).toBe(
			'- 09:05 Buy the dip?\n- 14:30 two\n  lines\n',
		);
	});
});
