import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from './fixtures';

test.setTimeout(90_000);

test('search in files: results by file, options, and click-through to the line', async ({
	page,
}) => {
	const project = mkdtempSync(join(tmpdir(), 'forge-search-'));
	mkdirSync(join(project, 'src'));
	mkdirSync(join(project, 'node_modules'));
	const filler = Array.from({ length: 39 }, (_, i) => `// line ${i + 1}`).join('\n');
	writeFileSync(join(project, 'src', 'trade.py'), `${filler}\nPRICE_FEED = connect()\n`);
	writeFileSync(join(project, 'src', 'ui.ts'), 'const priceFeed = 1;\nconst price_feed = 2;\n');
	writeFileSync(join(project, 'node_modules', 'x.js'), 'price_feed everywhere');
	try {
		await page.evaluate((p) => window.forge.invoke('workspace:open', p), project);
		await page.keyboard.press('Control+Shift+F');
		const panel = page.locator('[data-search-panel]');
		const input = panel.getByRole('textbox', { name: 'Search in files' });
		await expect(input).toBeFocused();

		await input.fill('price_feed');
		await expect(panel.locator('[data-search-summary]')).toContainText('2 results in 2 files');
		await expect(panel.locator('[data-search-file="node_modules/x.js"]')).toHaveCount(0);

		await panel.getByRole('button', { name: 'Match case' }).click();
		await expect(panel.locator('[data-search-summary]')).toContainText('1 result in 1 file');
		await panel.getByRole('button', { name: 'Match case' }).click();

		await panel.getByRole('button', { name: 'Regular expression' }).click();
		await input.fill('price_?feed');
		await expect(panel.locator('[data-search-summary]')).toContainText('3 results in 2 files');
		await input.fill('(broken');
		await expect(panel.getByRole('alert')).toBeVisible();
		await input.fill('PRICE_FEED');

		await panel.locator('[data-search-match="src/trade.py:40"]').click();
		const editor = page.locator('[data-editor-host] .monaco-editor');
		await expect(editor).toBeVisible({ timeout: 45_000 });
		await expect(page.locator('footer')).toContainText('Ln 40');
	} finally {
		rmSync(project, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
