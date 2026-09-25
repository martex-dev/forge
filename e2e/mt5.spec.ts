import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(180_000);

const terminalRunning = (): boolean => {
	try {
		return execFileSync('tasklist', ['/FI', 'IMAGENAME eq terminal64.exe', '/NH'])
			.toString()
			.toLowerCase()
			.includes('terminal64.exe');
	} catch {
		return false;
	}
};

test('MT5 panel: real sidecar never launches the terminal; shows the account when one is running', async () => {
	test.skip(process.platform !== 'win32', 'MT5 is Windows-only');
	const wasRunning = terminalRunning();
	const dir = mkdtempSync(join(tmpdir(), 'forge-mt5-'));
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${dir}`],
		env: { ...process.env, FORGE_E2E: '1' },
	});
	try {
		const page = await app.firstWindow();
		await expect(page.locator('[data-sidecar-state]')).toHaveAttribute(
			'data-sidecar-state',
			'ready',
			{
				timeout: 120_000,
			},
		);
		await page.keyboard.press('Control+2');
		await page.locator('[data-room-layout="trade"] .dv-tab', { hasText: /^MT5$/ }).click();
		if (wasRunning) {
			await expect(
				page.locator('[data-mt5-account]').or(page.getByText('not logged in')),
			).toBeVisible({ timeout: 30_000 });
		} else {
			await expect(page.getByText('MetaTrader 5 not connected')).toBeVisible({
				timeout: 30_000,
			});
			await expect(page.getByText(/not running/)).toBeVisible();
			// Checking must not have started the terminal.
			expect(terminalRunning()).toBe(false);
		}
	} finally {
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
