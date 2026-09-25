import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(240_000);

/** Monday–Friday (US Eastern) of the week the panel opens on, as the renderer computes it. */
function thisWeek(now: number): string[] {
	const today = new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/New_York',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now);
	const d = new Date(`${today}T00:00:00Z`);
	const dow = d.getUTCDay();
	d.setUTCDate(d.getUTCDate() + (dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow));
	return Array.from({ length: 5 }, (_, i) => {
		const day = new Date(d);
		day.setUTCDate(d.getUTCDate() + i);
		return day.toISOString().slice(0, 10);
	});
}

const row = (symbol: string, cap: string): Record<string, string> => ({
	symbol,
	name: `${symbol} Corp`,
	time: 'time-after-hours',
	marketCap: cap,
	epsForecast: '$1.50',
	lastYearEPS: '$1.20',
});

test('earnings: seeded NASDAQ week, index filter, impact filter, journal idea, source settings', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-earnings-'));
	const now = Date.now();
	// Seeded sidecar cache (fresh), so the test never calls NASDAQ or Wikipedia.
	const cache = join(dir, 'sidecar', 'cache', 'earnings');
	mkdirSync(cache, { recursive: true });
	const write = (key: string, value: unknown): void =>
		writeFileSync(
			join(cache, `${key}.json`),
			JSON.stringify({ value, fetched_at: now / 1000 }),
		);
	write('constituents', ['AAPL', 'WM']);
	const [monday, ...rest] = thisWeek(now);
	write(`nasdaq-${monday}`, [row('AAPL', '$3,500,000,000,000'), row('ZZZZ', '$1,000,000')]);
	write(`nasdaq-${rest[1]}`, [row('WM', '$83,000,000,000')]);
	for (const d of [rest[0], rest[2], rest[3]]) write(`nasdaq-${d}`, []);

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
		await page.keyboard.press('Control+2');
		await page.locator('[data-room-layout="trade"] .dv-tab', { hasText: /^Earnings$/ }).click();
		const panel = page.locator('[data-earnings]');

		await expect(panel.locator('[data-earnings-symbol="AAPL"]')).toBeVisible({
			timeout: 30_000,
		});
		await expect(panel.locator('[data-earnings-symbol="WM"]')).toBeVisible();
		// Not an S&P 500 / Nasdaq-100 constituent.
		await expect(panel.locator('[data-earnings-symbol="ZZZZ"]')).toHaveCount(0);
		await expect(panel.locator('[data-earnings-symbol="AAPL"]')).toContainText('$1.50');

		// AAPL is a mega cap (high impact); hiding "High" leaves WM (medium).
		await panel.getByRole('button', { name: 'High', exact: true }).click();
		await expect(panel.locator('[data-earnings-symbol="AAPL"]')).toHaveCount(0);
		await expect(panel.locator('[data-earnings-symbol="WM"]')).toBeVisible();
		await panel.getByRole('button', { name: 'High', exact: true }).click();

		// A pre-earnings idea goes to the Trade Journal.
		await panel.getByRole('button', { name: 'Journal idea for AAPL' }).click();
		const form = page.locator('[data-journal-form]');
		await expect(form.getByRole('textbox', { name: 'Symbol' })).toHaveValue('AAPL');
		await expect(form.getByRole('textbox', { name: 'Notes' })).toHaveValue(
			/^Earnings .*EPS est\. \$1\.50/,
		);
		await form.getByRole('button', { name: 'Back to entries' }).click();

		// Source settings: Finnhub asks for a key, Market Calendar insists on https.
		await page.locator('[data-room-layout="trade"] .dv-tab', { hasText: /^Earnings$/ }).click();
		await panel.getByRole('button', { name: 'Earnings source…' }).click();
		const dialog = page.locator('[data-earnings-settings]');
		await dialog.getByRole('combobox', { name: 'Earnings source' }).click();
		await page.getByRole('option', { name: 'Finnhub (API key)' }).click();
		await expect(dialog).toContainText('No Finnhub key yet.');
		await dialog.getByRole('combobox', { name: 'Earnings source' }).click();
		await page.getByRole('option', { name: 'Market Calendar (your deployment)' }).click();
		await dialog
			.getByRole('textbox', { name: 'Market Calendar URL' })
			.fill('http://example.com');
		await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
		await page.getByRole('button', { name: 'Cancel' }).click();
		await expect(panel.locator('[data-earnings-symbol="AAPL"]')).toBeVisible();
	} finally {
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
