import type { ElectronApplication, Page } from '@playwright/test';

import { expect, test } from './fixtures';

interface ViewState {
	instanceId: string;
	visible: boolean;
	partition: string;
	bounds: { x: number; y: number; width: number; height: number };
}

async function tvState(app: ElectronApplication): Promise<ViewState | undefined> {
	const all = await app.evaluate(() => {
		const svc = (globalThis as { __forgeWebviews?: { debugState(): unknown[] } })
			.__forgeWebviews;
		return (svc?.debugState() ?? []) as unknown[];
	});
	return (all as ViewState[]).find((v) => v.instanceId === 'tradingview.chart');
}

async function hostRect(page: Page): Promise<ViewState['bounds'] | null> {
	return page.evaluate(() => {
		const el = document.querySelector('[data-webview-host="tradingview.chart"]');
		if (!el) return null;
		const r = el.getBoundingClientRect();
		return {
			x: Math.round(r.left),
			y: Math.round(r.top),
			width: Math.round(r.width),
			height: Math.round(r.height),
		};
	});
}

test('TradingView webview: own partition, aligned to its panel, hidden under overlays and other rooms', async ({
	app,
	page,
}) => {
	await page.locator('[data-room-layout="build"]').waitFor();
	await page.keyboard.press('Control+2');

	await expect.poll(async () => (await tvState(app))?.visible, { timeout: 15_000 }).toBe(true);
	const state = await tvState(app);
	expect(state?.partition).toBe('persist:svc-tradingview');
	await expect.poll(async () => (await tvState(app))?.bounds).toEqual(await hostRect(page));

	// Palette open → view hidden so it can't cover the overlay.
	await page.keyboard.press('Control+k');
	await expect.poll(async () => (await tvState(app))?.visible).toBe(false);
	await page.keyboard.press('Escape');
	await expect.poll(async () => (await tvState(app))?.visible).toBe(true);

	// Settings dialog also hides it.
	await page.keyboard.press('Control+,');
	await expect.poll(async () => (await tvState(app))?.visible).toBe(false);
	await page.keyboard.press('Escape');
	await expect.poll(async () => (await tvState(app))?.visible).toBe(true);

	// Other room → hidden; back → visible again, same instance (not reloaded).
	await page.keyboard.press('Control+1');
	await expect.poll(async () => (await tvState(app))?.visible).toBe(false);
	await page.keyboard.press('Control+2');
	await expect.poll(async () => (await tvState(app))?.visible).toBe(true);

	// Resizing the window keeps the view aligned with its panel.
	await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1200, 800));
	await expect
		.poll(
			async () =>
				JSON.stringify((await tvState(app))?.bounds) ===
				JSON.stringify(await hostRect(page)),
		)
		.toBe(true);
});
