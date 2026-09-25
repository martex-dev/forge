import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(240_000);

test('alerts: calendar alert fires into the inbox; price alerts can be created, toggled, deleted', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-alerts-'));
	const now = Date.now();
	// Seeded Forex Factory cache (as in calendar.spec): a high-impact USD event in 10 minutes.
	mkdirSync(join(dir, 'sidecar', 'cache'), { recursive: true });
	writeFileSync(
		join(dir, 'sidecar', 'cache', 'ff-week.json'),
		JSON.stringify({
			value: [
				{
					title: 'Non-Farm Employment Change',
					country: 'USD',
					date: new Date(now + 10 * 60_000).toISOString(),
					impact: 'High',
					forecast: '150K',
					previous: '142K',
				},
			],
			fetched_at: now / 1000,
		}),
	);
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
		await page.locator('[data-room-layout="trade"] .dv-tab', { hasText: /^Alerts$/ }).click();
		const panel = page.locator('[data-alerts]');

		// Calendar alert: 15 minutes before high-impact USD events.
		await panel.getByRole('button', { name: 'New alert' }).click();
		await panel.getByRole('button', { name: 'Calendar event' }).click();
		await panel.getByRole('textbox', { name: 'Currencies' }).fill('USD');
		await panel.getByRole('button', { name: 'Create alert' }).click();
		await expect(
			panel.locator('[data-alert^="15 min before high impact · USD"]'),
		).toBeVisible();

		// Main checks every 15 s; the event is 10 minutes out, inside the window.
		await expect
			.poll(
				async () => {
					const res = (await page.evaluate(() =>
						window.forge.invoke('notifications:list'),
					)) as {
						data?: Array<{ title: string; level: string }>;
					};
					return res.data?.find((n) => n.title.includes('Non-Farm Employment Change'));
				},
				{ timeout: 45_000, intervals: [2_000] },
			)
			.toMatchObject({
				level: 'warn',
				title: expect.stringMatching(/^USD Non-Farm Employment Change in \d+ min$/),
			});

		// Price alert CRUD (no market data needed to save it).
		await panel.getByRole('button', { name: 'New alert' }).click();
		await panel.getByRole('textbox', { name: 'Symbol' }).fill('ETHUSDT');
		await panel.getByRole('textbox', { name: 'Price' }).fill('5000');
		await panel.getByRole('button', { name: 'Create alert' }).click();
		const row = panel.locator('[data-alert="ETHUSDT crosses above 5,000"]');
		await expect(row).toBeVisible();
		await row.getByRole('switch').click();
		await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'false');
		await row.getByRole('button', { name: 'Delete' }).click();
		await expect(row).toHaveCount(0);
	} finally {
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
