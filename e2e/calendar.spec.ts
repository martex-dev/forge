import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(180_000);

/**
 * Real sidecar, no network: the sidecar's disk cache is seeded with a fresh week, which is
 * exactly what a restart looks like (Forex Factory rate-limits, so restarts must not re-fetch).
 */
test('economic calendar: countdown, imminent highlight and filters', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-cal-'));
	const now = Date.now();
	const iso = (min: number): string => new Date(now + min * 60_000).toISOString();
	const feed = [
		{
			title: 'Past Medium',
			country: 'EUR',
			date: iso(-120),
			impact: 'Medium',
			forecast: '',
			previous: '',
		},
		{
			title: 'Soon High',
			country: 'USD',
			date: iso(20),
			impact: 'High',
			forecast: '0.2%',
			previous: '0.3%',
		},
		{
			title: 'Later High',
			country: 'GBP',
			date: iso(300),
			impact: 'High',
			forecast: '',
			previous: '',
		},
		{
			title: 'Later Low',
			country: 'NZD',
			date: iso(400),
			impact: 'Low',
			forecast: '',
			previous: '',
		},
	];
	mkdirSync(join(dir, 'sidecar', 'cache'), { recursive: true });
	writeFileSync(
		join(dir, 'sidecar', 'cache', 'ff-week.json'),
		JSON.stringify({ value: feed, fetched_at: now / 1000 }),
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
		const list = page.getByRole('list', { name: 'Economic events' });
		await expect(list.getByText('Soon High')).toBeVisible({ timeout: 30_000 });

		// Countdown targets the next high-impact event; it's within 30 min, so it's highlighted.
		const soonId = await list.locator('[data-imminent]').first().getAttribute('data-event-id');
		await expect(page.locator(`[data-next-high="${soonId}"]`)).toBeVisible();

		// Default filters hide low impact; toggling Low shows it.
		await expect(list.getByText('Later Low')).toHaveCount(0);
		await page
			.getByRole('toolbar', { name: 'Calendar filters' })
			.getByRole('button', { name: /Low/ })
			.click();
		await expect(list.getByText('Later Low')).toBeVisible();

		// Currency filter.
		await page
			.getByRole('toolbar', { name: 'Calendar filters' })
			.getByRole('button', { name: 'GBP' })
			.click();
		await expect(list.getByText('Later High')).toBeVisible();
		await expect(list.getByText('Soon High')).toHaveCount(0);
	} finally {
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
