import { expect, test } from './fixtures';

interface ViewState {
	instanceId: string;
	visible: boolean;
	partition: string;
}

test('Hub web tabs open in their own persistent partitions', async ({ app, page }) => {
	await page.locator('[data-room-layout="build"]').waitFor();
	await page.keyboard.press('Control+4');
	for (const [command, id] of [
		['Hub: Open Discord', 'discord'],
		['Hub: Open X', 'x'],
	] as const) {
		await page.keyboard.press('Control+K');
		await page.keyboard.type(command);
		await page.keyboard.press('Enter');
		await expect
			.poll(async () => {
				const all = (await app.evaluate(() => {
					const svc = (globalThis as { __forgeWebviews?: { debugState(): unknown[] } })
						.__forgeWebviews;
					return svc?.debugState() ?? [];
				})) as ViewState[];
				return all.find((v) => v.instanceId === `hub-web.${id}`);
			})
			.toMatchObject({ partition: `persist:svc-${id}`, visible: true });
	}
});
