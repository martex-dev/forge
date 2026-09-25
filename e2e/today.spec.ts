import { expect, test } from './fixtures';

test('Today: trading P/L and unread inbox at a glance; cards open their panels', async ({
	page,
}) => {
	await page.locator('[data-room-layout="build"]').waitFor();
	await page.evaluate(async () => {
		const now = Date.now();
		await window.forge.invoke('journal:save', {
			id: '11111111-1111-4111-8111-111111111111',
			symbol: 'EURUSD',
			market: 'forex',
			side: 'long',
			status: 'closed',
			entry: 1.08,
			exit: 1.085,
			size: 10_000,
			stop: 1.078,
			target: null,
			pnl: null,
			fees: 0,
			openedAt: now - 3_600_000,
			closedAt: now,
			setup: 'breakout',
			tags: [],
			notes: '',
			images: [],
			createdAt: now,
			updatedAt: now,
		});
		await window.forge.invoke('notifications:add', {
			module: 'runs',
			title: 'Run failed: resnet-sweep',
			level: 'error',
		});
	});
	await page.keyboard.press('Control+Shift+T');
	const today = page.locator('[data-today]');
	await expect(today).toContainText(/Good (morning|afternoon|evening)|Late night/);
	const trading = today.locator('[data-today-card="Trading today"]');
	await expect(trading).toContainText('+50');
	await expect(today.locator('[data-today-card="Inbox"]')).toContainText(
		'Run failed: resnet-sweep',
	);
	// Without the sidecar, market cards say so instead of breaking the dashboard.
	await expect(today.locator('[data-today-card="Macro today"]')).toContainText('Not available');

	await trading.getByRole('button', { name: 'Open Trading today' }).click();
	await expect(page.locator('[data-room-layout="trade"]')).toBeVisible();
	await expect(page.locator('[data-journal-entry="EURUSD"]')).toBeVisible();
});
