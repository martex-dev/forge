import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, type Page, test } from '@playwright/test';

test.setTimeout(120_000);

async function launch(dir: string): ReturnType<typeof electron.launch> {
	return electron.launch({
		args: ['.', `--user-data-dir=${dir}`],
		env: { ...process.env, FORGE_NO_SIDECAR: '1', FORGE_E2E: '1' },
	});
}

const tabTitles = (page: Page): Promise<string[]> =>
	page
		.locator('[data-room-layout="trade"] .dv-tab')
		.allInnerTexts()
		.then((t) =>
			t
				.map((s) => s.trim())
				.filter((s) => s.includes(' · '))
				.sort(),
		);

test('chart grid: four charts with their own symbols, restored after restart', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-grid-'));
	try {
		const first = await launch(dir);
		try {
			const page = await first.firstWindow();
			await page.locator('[data-room-layout="trade"]').waitFor({ state: 'attached' });
			await page.keyboard.press('Control+K');
			await page.keyboard.type('Chart Grid');
			await page.keyboard.press('Enter');
			await expect(page.locator('[data-room-layout="trade"] [data-chart-panel]')).toHaveCount(
				4,
				{
					timeout: 20_000,
				},
			);
			await expect
				.poll(() => tabTitles(page))
				.toEqual(['BNBUSDT · 1h', 'BTCUSDT · 1h', 'ETHUSDT · 1h', 'SOLUSDT · 1h']);
			await page.waitForTimeout(1_000); // layout save is debounced
		} finally {
			await first.close();
		}

		const second = await launch(dir);
		try {
			const page = await second.firstWindow();
			await page.locator('[data-room-layout="trade"]').waitFor({ state: 'attached' });
			await page.keyboard.press('Control+2');
			await expect(page.locator('[data-room-layout="trade"] [data-chart-panel]')).toHaveCount(
				4,
				{
					timeout: 20_000,
				},
			);
			expect(await tabTitles(page)).toEqual([
				'BNBUSDT · 1h',
				'BTCUSDT · 1h',
				'ETHUSDT · 1h',
				'SOLUSDT · 1h',
			]);
		} finally {
			await second.close();
		}
	} finally {
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
