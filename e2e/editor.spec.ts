import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from './fixtures';

test.setTimeout(90_000);

test('open a file from the explorer, see highlighting, edit and save with Ctrl+S', async ({
	page,
}) => {
	const project = mkdtempSync(join(tmpdir(), 'forge-editor-'));
	writeFileSync(join(project, 'main.ts'), 'export const answer: number = 42;\n');
	try {
		await page.evaluate((p) => window.forge.invoke('workspace:open', p), project);
		const tree = page.getByRole('tree', { name: 'Files' });
		await tree.getByRole('treeitem', { name: /main\.ts/ }).click();

		const editor = page.locator('[data-editor-host] .monaco-editor');
		await expect(editor).toBeVisible({ timeout: 45_000 });
		await expect(editor.locator('.view-lines')).toContainText('export const answer');

		// TextMate tokenization gives keywords, identifiers and numbers different token classes.
		await expect
			.poll(
				async () =>
					new Set(
						await editor
							.locator('.view-line span span')
							.evaluateAll((spans) => spans.map((s) => s.className)),
					).size,
				{ timeout: 20_000 },
			)
			.toBeGreaterThan(2);

		// Edit: tab shows the unsaved marker; Ctrl+S writes to disk and clears it.
		await editor.locator('.view-lines').click();
		await page.keyboard.press('Control+End');
		await page.keyboard.type('// saved from forge');
		const tab = page.getByRole('tab', { name: /main\.ts/ });
		await expect(tab.getByRole('button', { name: /unsaved/ })).toBeVisible();
		await page.keyboard.press('Control+s');
		await expect(tab.getByRole('button', { name: /unsaved/ })).toHaveCount(0);
		expect(readFileSync(join(project, 'main.ts'), 'utf8')).toContain('// saved from forge');

		// Status bar shows the language.
		await expect(page.locator('footer')).toContainText('typescript');
	} finally {
		rmSync(project, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
