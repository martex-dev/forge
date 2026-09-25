import { expect, test } from './fixtures';

test('inbox: repeats collapse, sources filter, search, Delete removes', async ({ page }) => {
	await page.locator('[data-room-layout="build"]').waitFor();
	await page.evaluate(async () => {
		const add = (
			module: string,
			title: string,
			level: 'info' | 'warn' | 'error',
		): Promise<unknown> => window.forge.invoke('notifications:add', { module, title, level });
		await add('github', 'PR #12 approved', 'info');
		for (let i = 0; i < 3; i++) await add('alerts', 'BTCUSDT crossed 100,000', 'warn');
		await add('vercel', 'Deploy failed: forge-web', 'error');
	});
	await page.keyboard.press('Control+4');
	const inbox = page.locator('[data-inbox]');
	const alert = inbox.locator('[data-notification]', { hasText: 'BTCUSDT crossed 100,000' });
	await expect(alert).toHaveCount(1);
	await expect(alert).toContainText('×3');

	const sources = inbox.getByRole('toolbar', { name: 'Sources' });
	await sources.getByRole('button', { name: /^Alerts/ }).click();
	await expect(inbox.locator('[data-notification]')).toHaveCount(1);
	await sources.getByRole('button', { name: /^All/ }).click();

	await inbox.getByRole('textbox', { name: 'Search notifications' }).fill('forge-web');
	await expect(inbox.locator('[data-notification]')).toHaveCount(1);
	await inbox.getByRole('textbox', { name: 'Search notifications' }).fill('');

	// Keyboard: focus a row, ↓ to the next, Delete removes it (with its repeats).
	await inbox.locator('[data-notification]').first().focus();
	await page.keyboard.press('ArrowDown');
	const focused = await page.evaluate(
		() => (document.activeElement as HTMLElement).dataset['ids'],
	);
	await page.keyboard.press('Delete');
	await expect(inbox.locator(`[data-ids="${focused}"]`)).toHaveCount(0);
	await expect(inbox.locator('[data-notification]')).toHaveCount(2);
});
