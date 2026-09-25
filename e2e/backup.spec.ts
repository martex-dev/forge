import { randomUUID } from 'node:crypto';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, type ElectronApplication, expect, test } from '@playwright/test';

const running = new Set<ElectronApplication>();

// A failed assertion must still close the app, or its locks hide the failure behind EPERM on cleanup.
test.afterEach(async () => {
	await Promise.all([...running].map((app) => app.close().catch(() => undefined)));
	running.clear();
});

async function launch(userDataDir: string): Promise<ElectronApplication> {
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${userDataDir}`],
		env: { ...process.env, FORGE_NO_SIDECAR: '1', FORGE_E2E: '1' },
	});
	running.add(app);
	app.on('close', () => running.delete(app));
	return app;
}

async function stubFolderDialog(app: ElectronApplication, dir: string): Promise<void> {
	await app.evaluate(({ dialog }, path) => {
		dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
	}, dir);
}

test('a backup restores settings and the journal on another install', async () => {
	const tmp = mkdtempSync(join(tmpdir(), 'forge-backup-'));
	const source = join(tmp, 'source');
	const target = join(tmp, 'target');
	const backups = join(tmp, 'backups');
	const id = randomUUID();
	try {
		const first = await launch(source);
		const page1 = await first.firstWindow();
		await page1.evaluate(async (entryId) => {
			const now = Date.now();
			await window.forge.invoke('settings:updateGeneral', { fontSize: 12 });
			const saved = await window.forge.invoke('journal:save', {
				id: entryId,
				symbol: 'BTCUSDT',
				market: 'crypto',
				side: 'long',
				status: 'closed',
				entry: 100,
				exit: 110,
				size: 1,
				stop: null,
				target: null,
				pnl: null,
				fees: 0,
				openedAt: now,
				closedAt: now,
				setup: 'breakout',
				tags: [],
				notes: 'kept across machines',
				images: [],
				createdAt: now,
				updatedAt: now,
			});
			if (!saved.ok) throw new Error(saved.error.message);
		}, id);
		await stubFolderDialog(first, backups);
		const exported = await page1.evaluate(() => window.forge.invoke('backup:export'));
		expect(exported.ok).toBe(true);
		await first.close();
		const [folder] = readdirSync(backups);
		expect(folder).toMatch(/^forge-backup-/);

		// A fresh install restores it through the palette, the way Marto would.
		const second = await launch(target);
		const page2 = await second.firstWindow();
		await page2.locator('[data-room-layout="build"]').waitFor();
		await stubFolderDialog(second, join(backups, folder ?? ''));
		await page2.keyboard.press('Control+k');
		await page2.keyboard.type('restore from backup');
		await page2.keyboard.press('Enter');
		const preview = page2.locator('[data-restore-preview]');
		await expect(preview).toContainText('The journal folder');
		await page2.getByRole('button', { name: 'Replace my current setup' }).click();
		await expect(page2.getByRole('button', { name: 'Restart Forge now' })).toBeVisible();
		await second.close();

		const third = await launch(target);
		const page3 = await third.firstWindow();
		const state = await page3.evaluate(async () => ({
			general: await window.forge.invoke('settings:getGeneral'),
			journal: await window.forge.invoke('journal:list'),
		}));
		expect(state.general).toMatchObject({ ok: true, data: { fontSize: 12 } });
		expect(state.journal).toMatchObject({
			ok: true,
			data: [{ id, symbol: 'BTCUSDT', notes: 'kept across machines' }],
		});
		await third.close();
	} finally {
		rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});

test('the welcome guide opens from the palette and links to Secrets', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-welcome-'));
	try {
		const app = await launch(dir);
		const page = await app.firstWindow();
		await page.locator('[data-room-layout="build"]').waitFor();
		// Test runs never auto-open it (FORGE_E2E), so this is the palette path.
		await expect(page.locator('[data-onboarding]')).toHaveCount(0);
		await page.keyboard.press('Control+k');
		await page.keyboard.type('welcome guide');
		await page.keyboard.press('Enter');
		const guide = page.locator('[data-onboarding]');
		await expect(guide).toContainText('Choose your Obsidian vault');
		await guide.getByRole('button', { name: 'Secrets' }).click();
		await expect(guide).toHaveCount(0);
		await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible();
		const done = await page.evaluate(() => window.forge.invoke('app:onboarding'));
		// Marked done, and it stays hidden in test runs either way.
		expect(done).toMatchObject({ ok: true, data: { show: false } });
		await app.close();
	} finally {
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
