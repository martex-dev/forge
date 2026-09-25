import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, type Page, test } from '@playwright/test';

test.setTimeout(120_000);

// No sidecar and no network: candle parsing is covered by pytest, the live path was checked by
// hand. This covers the panel's controls, its error state and that its params survive a restart.
async function launch(userDataDir: string): ReturnType<typeof electron.launch> {
	return electron.launch({
		args: ['.', `--user-data-dir=${userDataDir}`],
		env: { ...process.env, FORGE_NO_SIDECAR: '1', FORGE_E2E: '1' },
	});
}

async function openChart(page: Page): Promise<void> {
	// Room shortcuts only work once the shell (and its layouts) has mounted.
	await page.locator('[data-room-layout="trade"]').waitFor({ state: 'attached' });
	await page.keyboard.press('Control+2');
	await expect(page.locator('[data-room-layout="trade"]')).toBeVisible();
	await page.locator('[data-room-layout="trade"] .dv-tab', { hasText: /^Chart$/ }).click();
	await expect(page.getByRole('toolbar', { name: 'Chart controls' })).toBeVisible();
}

test('chart panel: controls, error state and params persisted with the layout', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-chart-'));
	try {
		const first = await launch(dir);
		try {
			const page = await first.firstWindow();
			await openChart(page);
			const toolbar = page.getByRole('toolbar', { name: 'Chart controls' });
			const symbol = toolbar.getByRole('textbox', { name: 'Binance symbol' });
			await expect(symbol).toHaveValue('BTCUSDT');
			await expect(page.getByText('Chart unavailable')).toBeVisible({ timeout: 20_000 });

			await symbol.fill('ethusdt');
			await symbol.press('Enter');
			await expect(symbol).toHaveValue('ETHUSDT');
			await toolbar.getByRole('button', { name: '4h candles' }).click();
			await expect(toolbar.getByRole('button', { name: '4h candles' })).toHaveAttribute(
				'aria-pressed',
				'true',
			);

			// Invalid symbols are rejected and the input reverts.
			await symbol.fill('BTC/USDT');
			await symbol.press('Enter');
			await expect(symbol).toHaveValue('ETHUSDT');

			// Pool mode without a watched pair asks for one instead of charting stale data.
			await toolbar.getByRole('button', { name: 'DEX pool' }).click();
			await expect(page.getByText('Pick a pool')).toBeVisible();
			await toolbar.getByRole('button', { name: 'Binance' }).click();
			await symbol.fill('ETHUSDT');
			await symbol.press('Enter');
			// Layout saves are debounced (400 ms).
			await page.waitForTimeout(1_000);
		} finally {
			await first.close();
		}

		const second = await launch(dir);
		try {
			const page = await second.firstWindow();
			await openChart(page);
			const toolbar = page.getByRole('toolbar', { name: 'Chart controls' });
			await expect(toolbar.getByRole('textbox', { name: 'Binance symbol' })).toHaveValue(
				'ETHUSDT',
			);
			await expect(toolbar.getByRole('button', { name: '4h candles' })).toHaveAttribute(
				'aria-pressed',
				'true',
			);
		} finally {
			await second.close();
		}
	} finally {
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
