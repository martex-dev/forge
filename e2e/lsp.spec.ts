import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from './fixtures';

test.setTimeout(150_000);

const PY = [
	'def add(a: int, b: int) -> int:',
	'    return a + b',
	'',
	'',
	'total = add(1, 2)',
	'broken = add("x", 1)',
	'',
].join('\n');

test('LSP (basedpyright): diagnostics, hover, go to definition, completion, rename', async ({
	page,
}) => {
	const project = mkdtempSync(join(tmpdir(), 'forge-lsp-'));
	writeFileSync(join(project, 'main.py'), PY);
	try {
		await page.evaluate((p) => window.forge.invoke('workspace:open', p), project);
		await page
			.getByRole('tree', { name: 'Files' })
			.getByRole('treeitem', { name: /main\.py/ })
			.click();
		const editor = page.locator('[data-editor-host] .monaco-editor');
		await expect(editor).toBeVisible({ timeout: 45_000 });
		await expect(page.locator('[data-lsp-status="python:ready"]')).toBeVisible({
			timeout: 60_000,
		});

		// Diagnostics: the str argument gets an error squiggle.
		await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });

		// Hover over `add` in line 5 shows its signature.
		const line5 = editor.locator('.view-line').nth(4);
		const addToken = line5.getByText('add', { exact: true });
		// Re-hover until it answers: a hover sent while the server is still analysing comes back
		// empty, and Monaco doesn't ask again while the mouse stays put.
		await expect(async () => {
			await page.mouse.move(0, 0);
			await addToken.hover();
			await expect(page.locator('.monaco-hover:not(.hidden)')).toContainText(
				/def add\(\s*a: int,\s*b: int\) -> int/,
				{ timeout: 3_000 },
			);
		}).toPass({ timeout: 30_000 });

		// Go to definition (F12) from the call jumps to line 1.
		await addToken.click();
		await page.keyboard.press('F12');
		await expect(page.locator('footer')).toContainText('Ln 1,', { timeout: 20_000 });

		// Completion: typing `tot` offers `total`.
		await editor.locator('.view-line').nth(6).click();
		await page.keyboard.type('tot');
		await page.keyboard.press('Control+Space');
		await expect(page.locator('.suggest-widget')).toContainText('total', { timeout: 20_000 });
		await page.keyboard.press('Escape');
		await page.keyboard.press('Control+Z');

		// Rename (F2) the function everywhere.
		await line5.getByText('add', { exact: true }).click();
		await page.keyboard.press('F2');
		const renameInput = page.locator('.rename-box input');
		await expect(renameInput).toBeVisible({ timeout: 20_000 });
		await renameInput.fill('plus');
		await page.keyboard.press('Enter');
		await expect(editor.locator('.view-lines')).toContainText('def plus(a: int', {
			timeout: 20_000,
		});
		// Rendered text includes inlay hints (`: int`, `a=`), so match loosely.
		await expect(editor.locator('.view-lines')).toContainText(/total.*=\splus\(.*1.*2\)/);
	} finally {
		// Closing the folder stops its language servers, which hold the directory open.
		await page.evaluate(() => window.forge.invoke('workspace:close'));
		await expect(page.locator('[data-lsp-status]')).toHaveCount(0, { timeout: 15_000 });
		await page.waitForTimeout(1_000);
		rmSync(project, { recursive: true, force: true, maxRetries: 20, retryDelay: 300 });
	}
});

test('LSP: go to definition across files (Python) and TypeScript diagnostics', async ({ page }) => {
	const project = mkdtempSync(join(tmpdir(), 'forge-lsp2-'));
	writeFileSync(join(project, 'util.py'), '\n\ndef helper(x: int) -> int:\n    return x * 2\n');
	writeFileSync(join(project, 'app.py'), 'from util import helper\n\nhelper(21)\n');
	writeFileSync(join(project, 'calc.ts'), 'export const n: number = "not a number";\n');
	try {
		await page.evaluate((p) => window.forge.invoke('workspace:open', p), project);
		const tree = page.getByRole('tree', { name: 'Files' });
		await tree.getByRole('treeitem', { name: /app\.py/ }).click();
		const editor = page.locator('[data-editor-host] .monaco-editor');
		await expect(editor).toBeVisible({ timeout: 45_000 });
		await expect(page.locator('[data-lsp-status*="python:ready"]')).toBeVisible({
			timeout: 60_000,
		});
		// F12 on the call in app.py opens util.py at the definition (line 3).
		await editor.locator('.view-line').nth(2).getByText('helper', { exact: true }).click();
		await page.keyboard.press('F12');
		await expect(page.getByRole('tab', { name: /util\.py/ })).toBeVisible({ timeout: 20_000 });
		await expect(page.locator('footer')).toContainText('Ln 3,', { timeout: 20_000 });

		// TypeScript: the server starts on demand and flags the bad assignment.
		await tree.getByRole('treeitem', { name: /calc\.ts/ }).click();
		await expect(page.locator('[data-lsp-status*="typescript:ready"]')).toBeVisible({
			timeout: 60_000,
		});
		await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 30_000 });
	} finally {
		// Closing the folder stops its language servers, which hold the directory open.
		await page.evaluate(() => window.forge.invoke('workspace:close'));
		await expect(page.locator('[data-lsp-status]')).toHaveCount(0, { timeout: 15_000 });
		await page.waitForTimeout(1_000);
		rmSync(project, { recursive: true, force: true, maxRetries: 20, retryDelay: 300 });
	}
});
