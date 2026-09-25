import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, type Page, test } from '@playwright/test';

test.setTimeout(180_000);

// 1×1 PNG.
const PNG =
	'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

async function launch(dir: string): ReturnType<typeof electron.launch> {
	return electron.launch({
		args: ['.', `--user-data-dir=${dir}`],
		env: { ...process.env, FORGE_NO_SIDECAR: '1', FORGE_E2E: '1' },
	});
}

async function pick(page: Page, label: string, option: string): Promise<void> {
	await page.locator('[data-journal-form]').getByRole('combobox', { name: label }).click();
	await page.getByRole('option', { name: option }).click();
}

test('journal: entry with a pasted screenshot, stats, persisted across restart', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-journal-'));
	try {
		const first = await launch(dir);
		try {
			const page = await first.firstWindow();
			await page.locator('[data-room-layout="trade"]').waitFor({ state: 'attached' });
			await page.keyboard.press('Control+Alt+J');
			const form = page.locator('[data-journal-form]');
			await expect(form).toBeVisible({ timeout: 20_000 });

			await form.getByRole('textbox', { name: 'Symbol' }).fill('eurusd');
			await pick(page, 'Market', 'forex');
			await pick(page, 'Status', 'Closed');
			await form.getByRole('textbox', { name: 'Entry' }).fill('1.08');
			await form.getByRole('textbox', { name: 'Stop' }).fill('1.078');
			await form.getByRole('textbox', { name: 'Exit' }).fill('1.085');
			await form.getByRole('textbox', { name: 'Size' }).fill('10000');
			await form.getByRole('textbox', { name: 'Tags' }).fill('london, a+');
			await form
				.getByRole('textbox', { name: 'Notes' })
				.fill('Clean **retest** of the range.');
			await expect(form.locator('[data-journal-metric="P/L"]')).toHaveText('+50');
			await expect(form.locator('[data-journal-metric="Result"]')).toHaveText('+2.50R');

			// A pasted screenshot saves the new entry first, then attaches.
			await form.evaluate((el, b64) => {
				const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
				const data = new DataTransfer();
				data.items.add(new File([bytes], 'shot.png', { type: 'image/png' }));
				el.dispatchEvent(
					new ClipboardEvent('paste', { clipboardData: data, bubbles: true }),
				);
			}, PNG);
			await expect(form.locator('[data-journal-images] img')).toHaveCount(1, {
				timeout: 10_000,
			});

			await form.getByRole('button', { name: 'Back to entries' }).click();
			const row = page.locator('[data-journal-entry="EURUSD"]');
			await expect(row).toContainText('+50');
			await expect(row).toContainText('#london');

			await page.locator('[data-journal]').getByRole('tab', { name: 'stats' }).click();
			await expect(page.locator('[data-journal-stat="Net P/L"]')).toHaveText('+50');
			await expect(page.locator('[data-journal-stat="Win rate"]')).toHaveText('100%');
			await page.waitForTimeout(1_000); // layout save is debounced
		} finally {
			await first.close();
		}

		const second = await launch(dir);
		try {
			const page = await second.firstWindow();
			await page.locator('[data-room-layout="trade"]').waitFor({ state: 'attached' });
			await page.keyboard.press('Control+2');
			await page
				.locator('[data-room-layout="trade"] .dv-tab', { hasText: /^Journal$/ })
				.click();
			await page.locator('[data-journal]').getByRole('tab', { name: 'entries' }).click();
			await page.locator('[data-journal-entry="EURUSD"]').click();
			const form = page.locator('[data-journal-form]');
			await expect(form.getByRole('textbox', { name: 'Notes' })).toHaveValue(
				'Clean **retest** of the range.',
			);
			await expect(form.locator('[data-journal-images] img')).toHaveCount(1);
			await form.getByRole('button', { name: 'Preview' }).click();
			await expect(form.locator('.md-preview strong')).toHaveText('retest');

			await form.getByRole('button', { name: 'Delete entry' }).click();
			await expect(page.locator('[data-journal-entry]')).toHaveCount(0);
		} finally {
			await second.close();
		}
	} finally {
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
