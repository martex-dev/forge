import { expect, test } from './fixtures';

test.setTimeout(90_000);

test('new terminal runs a command, and closing the tab kills the shell', async ({ page }) => {
	await page.locator('[data-room-layout="build"]').waitFor();
	await page.keyboard.press('Control+Shift+Backquote');

	const panel = page.locator('[data-terminal-session]').first();
	await expect(panel).toHaveAttribute('data-terminal-status', 'running', { timeout: 30_000 });
	const sessionId = await panel.getAttribute('data-terminal-session');
	expect(sessionId).toBeTruthy();

	// Type into xterm like a user.
	await panel.click();
	await page.keyboard.type('echo forge-e2e-$(1+1)');
	await page.keyboard.press('Enter');

	// Main keeps scrollback per session; reattaching returns it (that's what survives reloads).
	const backlog = async (): Promise<string> => {
		const res = await page.evaluate(
			(id) =>
				window.forge.invoke('terminal:open', {
					sessionId: id,
					preset: 'powershell',
					cols: 80,
					rows: 24,
				}),
			sessionId ?? '',
		);
		return res.ok ? res.data.backlog : '';
	};
	await expect.poll(backlog, { timeout: 20_000 }).toContain('forge-e2e-2');

	// Closing the dock tab ends the shell: reopening the id starts a fresh session.
	await page
		.getByRole('tab', { name: /PowerShell 1/ })
		.getByRole('button')
		.click();
	await expect(page.locator('[data-terminal-session]')).toHaveCount(0);
	await expect.poll(backlog, { timeout: 10_000 }).not.toContain('forge-e2e-2');
	await page.evaluate((id) => window.forge.invoke('terminal:kill', id), sessionId ?? '');
});
