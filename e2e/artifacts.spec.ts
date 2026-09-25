import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(240_000);

test('probe artifacts: CV folds and calibration show in the Run Monitor', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-artifacts-'));
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${dir}`],
		env: { ...process.env, FORGE_E2E: '1' },
	});
	try {
		const page = await app.firstWindow();
		await expect(page.locator('[data-sidecar-state]')).toHaveAttribute(
			'data-sidecar-state',
			'ready',
			{ timeout: 120_000 },
		);
		await page.keyboard.press('Control+3');
		const child = spawn(
			'uv',
			[
				'run',
				'--project',
				'packages/forge-probe',
				'python',
				'e2e/scripts/probe_artifacts.py',
				'artifacts-e2e',
			],
			{
				env: { ...process.env, FORGE_PROBE_FILE: join(dir, 'sidecar', 'probe.json') },
				stdio: 'ignore',
				windowsHide: true,
			},
		);
		child.on('error', () => undefined);

		const view = page.locator('[data-run-view]');
		await expect(view.getByRole('heading', { name: 'artifacts-e2e' })).toBeVisible({
			timeout: 60_000,
		});
		const folds = view.locator('[data-cv-folds="purged"]');
		await expect(folds).toBeVisible({ timeout: 20_000 });
		await expect(folds.getByRole('img')).toHaveCount(2);
		await expect(folds).toContainText('PurgedKFold(n_splits=2)');
		await expect(folds.locator('[data-cv-category="embargoed"]')).toHaveCount(1);
		// Fold 2 leaves rows 2-4 to nobody: unused, not purged.
		await expect(
			folds.getByRole('img', { name: 'Fold 2' }).locator('[data-cv-category="unused"]'),
		).toHaveCount(1);
		await expect(folds).toContainText('embargoed (serial-correlation margin)');

		const cal = view.locator('[data-calibration="val"]');
		await expect(cal.locator('[data-calibration-report="model"]')).toContainText('0.1500');
		await expect(cal.locator('[data-calibration-report="isotonic"]')).toBeVisible();
		await expect(cal).toContainText('Stub report for 4 predictions.');
	} finally {
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
