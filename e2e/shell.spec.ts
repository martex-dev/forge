import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, type ElectronApplication, type Page } from '@playwright/test';

import { expect, test } from './fixtures';

const roomAttr = (page: Page): Promise<string | null> =>
	page.evaluate(() => document.documentElement.getAttribute('data-room'));

test('Ctrl+1…4 switch rooms and update data-room', async ({ page }) => {
	await page.locator('[data-room-layout="build"]').waitFor();
	for (const [key, room] of [
		['2', 'trade'],
		['3', 'lab'],
		['4', 'hub'],
		['1', 'build'],
	] as const) {
		await page.keyboard.press(`Control+${key}`);
		await expect.poll(() => roomAttr(page)).toBe(room);
	}
});

test('only the active room is painted (inactive rooms never show through)', async ({ page }) => {
	await page.locator('[data-room-layout="build"]').waitFor();
	// What's actually on top at the center of the main area, not just what the DOM says.
	const topRoom = (): Promise<string | null> =>
		page.evaluate(() => {
			const main = document.querySelector('main')?.getBoundingClientRect();
			if (!main) return null;
			const hit = document.elementFromPoint(
				main.x + main.width / 2,
				main.y + main.height / 2,
			);
			return hit?.closest('[data-room-layout]')?.getAttribute('data-room-layout') ?? null;
		});
	await expect.poll(topRoom).toBe('build');
	await page.keyboard.press('Control+3');
	await expect.poll(topRoom).toBe('lab');
	await page.keyboard.press('Control+1');
	await expect.poll(topRoom).toBe('build');
});

test('palette opens with Ctrl+K and Ctrl+Shift+P and lists commands from all rooms', async ({
	page,
}) => {
	await page.locator('[data-room-layout="build"]').waitFor();
	await page.keyboard.press('Control+k');
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	for (const title of [
		'Build: Show Welcome',
		'Trade: Show Welcome',
		'Lab: Show Welcome',
		'Hub: Show Welcome',
		'Reset Layout of Current Room',
		'Dev: Open Design Playground',
	]) {
		await expect(dialog.getByText(title, { exact: true })).toBeVisible();
	}
	await page.keyboard.press('Escape');
	await expect(dialog).toBeHidden();

	await page.keyboard.press('Control+Shift+P');
	await expect(dialog).toBeVisible();
	await page.keyboard.type('trade welcome');
	await page.keyboard.press('Enter');
	await expect.poll(() => roomAttr(page)).toBe('trade');
});

test('disabling a module removes its panel and command live', async ({ page }) => {
	const explorerTab = page
		.locator('[data-room-layout="build"]')
		.getByRole('tab', { name: 'Explorer' });
	await expect(explorerTab).toBeVisible();

	await page.evaluate(() =>
		window.forge.invoke('modules:setEnabled', { id: 'explorer', enabled: false }),
	);
	await expect(explorerTab).toHaveCount(0);

	await page.keyboard.press('Control+k');
	await expect(page.getByRole('dialog').getByText('Build: Show Explorer')).toHaveCount(0);
	await page.keyboard.press('Escape');

	await page.evaluate(() =>
		window.forge.invoke('modules:setEnabled', { id: 'explorer', enabled: true }),
	);
	await expect(explorerTab).toBeVisible();
});

async function launch(dir: string): Promise<ElectronApplication> {
	return electron.launch({
		args: ['.', `--user-data-dir=${dir}`],
		env: { ...process.env, FORGE_NO_SIDECAR: '1', FORGE_E2E: '1' },
	});
}

test('layout survives a restart', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-layout-'));
	const apps: ElectronApplication[] = [];
	try {
		const first = await launch(dir);
		apps.push(first);
		const page1 = await first.firstWindow();
		const build1 = page1.locator('[data-room-layout="build"]');
		await expect(build1.getByRole('tab', { name: 'Explorer' })).toBeVisible();
		// Close every panel; the room should then show the empty watermark.
		const closeButtons = build1.locator('.dv-default-tab-action');
		while ((await closeButtons.count()) > 0) await closeButtons.first().click();
		await expect(build1.getByText('No panels open')).toBeVisible();
		await page1.waitForTimeout(1000); // debounce + write
		await first.close();

		const second = await launch(dir);
		apps.push(second);
		const page2 = await second.firstWindow();
		const build2 = page2.locator('[data-room-layout="build"]');
		await expect(build2.getByText('No panels open')).toBeVisible();
		await expect(build2.getByRole('tab')).toHaveCount(0);
	} finally {
		for (const app of apps) await app.close().catch(() => undefined);
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
