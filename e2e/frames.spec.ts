import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(240_000);

test('dataframe viewer: virtualized rows, sort, filter, SQL (read-only), stats', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-frames-'));
	const csv = join(dir, 'runs.csv');
	const lines = ['epoch,loss,split,note'];
	for (let i = 0; i < 5000; i++) {
		lines.push(`${i},${(1 / (i + 1)).toFixed(6)},${i % 4 === 0 ? 'val' : 'train'},n${i}`);
	}
	writeFileSync(csv, `${lines.join('\n')}\n`);

	const app = await electron.launch({
		args: ['.', `--user-data-dir=${join(dir, 'profile')}`],
		env: { ...process.env, FORGE_E2E: '1' },
	});
	try {
		const page = await app.firstWindow();
		await expect(page.locator('[data-sidecar-state]')).toHaveAttribute(
			'data-sidecar-state',
			'ready',
			{ timeout: 120_000 },
		);
		// The file dialog can't be driven here; opening once through IPC puts it in Recent.
		await page.evaluate((p) => window.forge.invoke('frames:open', p), csv);
		await page.keyboard.press('Control+3');
		await page.keyboard.press('Control+K');
		await page.keyboard.type('DataFrame Viewer');
		await page.keyboard.press('Enter');
		await page.getByRole('list', { name: 'Recent files' }).getByText('runs.csv').click();

		const panel = page.locator('[data-frame-panel="runs.csv"]');
		const grid = panel.locator('[data-frame-grid]');
		await expect(panel.locator('[data-frame-rows]')).toHaveText('5,000 rows · 4 cols', {
			timeout: 30_000,
		});
		await expect(grid.locator('[aria-rowindex="2"] [role="gridcell"]').first()).toHaveText('0');
		// Only a window of rows exists in the DOM.
		expect(await grid.locator('[role="row"][aria-rowindex]').count()).toBeLessThan(120);

		// Scroll to the end: the last block loads on demand.
		await grid.evaluate((el) => el.scrollTo({ top: el.scrollHeight }));
		await expect(grid.locator('[aria-rowindex="5001"] [role="gridcell"]').first()).toHaveText(
			'4999',
		);

		// Sort by loss descending (two clicks): epoch 0 has the largest loss.
		await grid.getByRole('columnheader', { name: /^loss/ }).click();
		await grid.getByRole('columnheader', { name: /^loss/ }).click();
		await expect(grid.getByRole('columnheader', { name: /^loss/ })).toHaveAttribute(
			'aria-sort',
			'descending',
		);
		await expect(grid.locator('[aria-rowindex="2"] [role="gridcell"]').nth(1)).toHaveText('1');

		// WHERE filter.
		await panel.getByRole('textbox', { name: 'Filter (SQL WHERE)' }).fill("split = 'val'");
		await page.keyboard.press('Enter');
		await expect(panel.locator('[data-frame-rows]')).toHaveText('1,250 of 5,000 rows · 4 cols');

		// SQL: aggregates work; anything but a single SELECT is refused.
		await panel.getByRole('tab', { name: 'SQL' }).click();
		const sql = panel.getByRole('textbox', { name: 'SQL query' });
		await sql.fill('SELECT split, count(*) AS n FROM t GROUP BY split ORDER BY split');
		await sql.press('Control+Enter');
		await expect(panel.locator('[aria-rowindex="2"]')).toContainText('train');
		await expect(panel.locator('[aria-rowindex="2"]')).toContainText('3750');
		await sql.fill("COPY t TO 'stolen.csv'");
		await sql.press('Control+Enter');
		await expect(panel.getByText(/Only SELECT queries are allowed/)).toBeVisible();

		// Stats + histogram.
		await panel.getByRole('tab', { name: 'Stats' }).click();
		const stats = panel.locator('[data-frame-stats]');
		await expect(stats.locator('[data-stats-column="epoch"]')).toContainText('4999');
		await stats.getByRole('button', { name: 'split' }).click();
		await expect(stats).toContainText('top 20 values');
		await expect(stats.getByLabel('split distribution')).toBeVisible();
	} finally {
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
