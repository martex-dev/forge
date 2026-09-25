import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from './fixtures';

test('explorer shows the opened folder and follows changes on disk', async ({ page }) => {
	const project = mkdtempSync(join(tmpdir(), 'forge-project-'));
	mkdirSync(join(project, 'src'));
	writeFileSync(join(project, 'src', 'index.ts'), 'export {};\n');
	writeFileSync(join(project, 'README.md'), '# demo\n');
	try {
		const tree = page.getByRole('tree', { name: 'Files' });
		await expect(page.getByText('No folder open')).toBeVisible();

		await page.evaluate((p) => window.forge.invoke('workspace:open', p), project);
		await expect(tree.getByRole('treeitem', { name: /README\.md/ })).toBeVisible();

		// Clicking a folder expands it.
		await tree.getByRole('treeitem', { name: /src/ }).click();
		await expect(tree.getByRole('treeitem', { name: /index\.ts/ })).toBeVisible();

		// A file created outside Forge shows up via the watcher.
		writeFileSync(join(project, 'NOTES.md'), 'x');
		await expect(tree.getByRole('treeitem', { name: /NOTES\.md/ })).toBeVisible({
			timeout: 10_000,
		});

		// Paths outside the workspace are refused by main.
		const escape = await page.evaluate(() => window.forge.invoke('fs:list', '../'));
		expect(escape).toMatchObject({ ok: false, error: { code: 'FS_OUTSIDE_WORKSPACE' } });
	} finally {
		await page.evaluate(() => window.forge.invoke('workspace:close'));
		rmSync(project, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
