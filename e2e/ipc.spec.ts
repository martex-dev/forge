import { expect, test } from './fixtures';

test('window.forge.invoke round-trips typed results', async ({ page }) => {
	const results = await page.evaluate(async () => {
		const version = await window.forge.invoke('app:getVersion');
		const platform = await window.forge.invoke('app:getPlatform');
		// Deliberately invalid input: must be rejected before reaching the handler.
		const bad = await window.forge.invoke('app:openExternal', 'file:///C:/Windows/notepad.exe');
		return { version, platform, bad };
	});
	expect(results.version).toEqual({ ok: true, data: expect.any(String) });
	expect(results.platform).toEqual({ ok: true, data: process.platform });
	expect(results.bad).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } });
});
