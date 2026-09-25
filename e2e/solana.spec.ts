import { expect, test } from './fixtures';

test.setTimeout(60_000);

test('Solana wallets: private keys refused, public address watched', async ({ page }) => {
	await page.locator('[data-room-layout="trade"]').waitFor({ state: 'attached' });
	await page.keyboard.press('Control+2');
	await page.locator('[data-room-layout="trade"] .dv-tab', { hasText: /^Wallets$/ }).click();
	const panel = page.locator('[data-solana]');
	await expect(panel.getByText('No wallets watched')).toBeVisible();
	const input = panel.getByRole('textbox', { name: 'Wallet address' });

	// Something shaped like a base58 secret key gets a specific warning and is not saved.
	await input.fill('3'.repeat(88));
	await panel.getByRole('button', { name: 'Watch' }).click();
	await expect(panel.getByRole('alert')).toContainText('looks like a private key');
	expect(await page.evaluate(() => window.forge.invoke('solana:wallets'))).toEqual({
		ok: true,
		data: [],
	});

	await input.fill('0xNotSolana');
	await panel.getByRole('button', { name: 'Watch' }).click();
	await expect(panel.getByRole('alert')).toContainText('Not a Solana public address');

	await input.fill('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
	await panel.getByRole('textbox', { name: 'Label' }).fill('Hot');
	await panel.getByRole('button', { name: 'Watch' }).click();
	await expect(panel.locator('[data-wallet="Hot"]')).toHaveAttribute('aria-pressed', 'true');
	// No sidecar in this fixture: the wallet view shows a clear error state, not a blank panel.
	await expect(
		panel.locator('[data-wallet-snapshot]').or(panel.getByText('Wallet unavailable')),
	).toBeVisible({ timeout: 20_000 });
});
