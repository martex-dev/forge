import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(240_000);

test('CV playground (purged vs KFold) and calibration from a file', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-ml-'));
	const csv = join(dir, 'preds.csv');
	const rows = ['label,prob,prob_iso'];
	for (let i = 0; i < 500; i++) {
		const p = (i % 100) / 100;
		rows.push(`${(i * 37) % 100 < p * 100 ? 1 : 0},${p},${Math.min(1, p * 0.9)}`);
	}
	writeFileSync(csv, `${rows.join('\n')}\n`);
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${join(dir, 'profile')}`],
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
		await page.keyboard.press('Control+3');
		await page.keyboard.press('Control+K');
		await page.keyboard.type('CV Folds Playground');
		await page.keyboard.press('Enter');

		const cv = page.locator('[data-ml-cv]');
		const folds = cv.locator('[data-cv-folds="playground"]');
		await expect(folds.getByRole('img')).toHaveCount(5, { timeout: 60_000 });
		await expect(folds.locator('[data-cv-category="purged"]').first()).toBeVisible();
		await expect(folds.locator('[data-cv-category="embargoed"]').first()).toBeVisible();

		await cv.getByRole('combobox', { name: 'Splitter' }).click();
		await page.getByRole('option', { name: 'KFold (sklearn)' }).click();
		await expect(folds).toContainText('KFold(');
		await expect(folds.locator('[data-cv-category="purged"]')).toHaveCount(0);
		await expect(folds).toContainText('doesn’t report purge or embargo');

		// Calibration: the native file dialog is stubbed to return the CSV.
		await app.evaluate(({ dialog }, path) => {
			dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [path] });
		}, csv);
		const tools = page.locator('[data-ml-tools]');
		await tools.getByRole('tab', { name: 'Calibration' }).click();
		const cal = page.locator('[data-ml-calibration]');
		await cal.getByRole('button', { name: 'Predictions file…' }).click();
		// label/prob were guessed from the column names.
		await expect(cal.getByRole('combobox', { name: 'Label column' })).toHaveText(/label/);
		await cal.getByRole('button', { name: 'prob_iso' }).click();
		await cal.getByRole('button', { name: 'Report' }).click();
		const view = cal.locator('[data-calibration="preds.csv"]');
		await expect(view.locator('[data-calibration-report="model"]')).toContainText('500', {
			timeout: 60_000,
		});
		await expect(view.locator('[data-calibration-report="prob_iso"]')).toBeVisible();
	} finally {
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
