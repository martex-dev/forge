import { expect, test } from './fixtures';

test('app launches with window title "Forge"', async ({ page }) => {
	await expect(page).toHaveTitle('Forge');
});
