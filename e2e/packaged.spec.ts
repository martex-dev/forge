import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(240_000);

// Runs against `npm run dist` output only: the installed layout (app.asar, unpacked native files,
// the PyInstaller sidecar in resources) is what breaks in ways the dev build can't show.
const EXE = resolve('release', 'win-unpacked', 'Forge.exe');

test.skip(!existsSync(EXE), 'no packaged build (run npm run dist)');

test('packaged app: bundled sidecar, ripgrep, terminal, SQLite and the Python language server', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-packaged-'));
	const project = mkdtempSync(join(tmpdir(), 'forge-packaged-proj-'));
	writeFileSync(
		join(project, 'main.py'),
		"def add(a: int, b: int) -> int:\n\treturn a + b\n\nadd('x', 1)\n",
	);
	const app = await electron.launch({ executablePath: EXE, args: [`--user-data-dir=${dir}`] });
	try {
		const page = await app.firstWindow();
		expect(await app.evaluate(({ app: a }) => a.isPackaged)).toBe(true);

		// The PyInstaller sidecar (no uv, no system Python).
		await expect(page.locator('[data-sidecar-state]')).toHaveAttribute(
			'data-sidecar-state',
			'ready',
			{
				timeout: 90_000,
			},
		);

		// Updates are live in an installed build; the releases repo has nothing published yet.
		expect(await page.evaluate(() => window.forge.invoke('update:status'))).toMatchObject({
			ok: true,
			data: { state: 'idle' },
		});
		const checked = await page.evaluate(() => window.forge.invoke('update:check'));
		expect(checked).toMatchObject({
			ok: true,
			data: { state: 'error', message: 'No release published yet' },
		});

		// SQLite (better-sqlite3 built for Electron).
		const added = await page.evaluate(() =>
			window.forge.invoke('notifications:add', {
				module: 'core',
				title: 'packaged',
				level: 'info',
			}),
		);
		expect(added).toMatchObject({ ok: true });

		// ripgrep from app.asar.unpacked.
		await page.evaluate((p) => window.forge.invoke('workspace:open', p), project);
		const found = await page.evaluate(() =>
			window.forge.invoke('search:run', { query: 'return a' }),
		);
		expect(found).toMatchObject({ ok: true });
		expect(JSON.stringify(found)).toContain('main.py');

		// basedpyright from app.asar.unpacked, run by Electron-as-Node: a real diagnostic.
		await page
			.getByRole('tree', { name: 'Files' })
			.getByRole('treeitem', { name: /main\.py/ })
			.click();
		const editor = page.locator('[data-editor-host] .monaco-editor');
		await expect(page.locator('[data-lsp-status="python:ready"]')).toBeVisible({
			timeout: 90_000,
		});
		await expect(editor.locator('.squiggly-error').first()).toBeVisible({ timeout: 60_000 });

		// node-pty prebuilds: a shell starts.
		await page.keyboard.press('Control+Shift+Backquote');
		await expect(page.locator('[data-terminal-session]').first()).toHaveAttribute(
			'data-terminal-status',
			'running',
			{
				timeout: 30_000,
			},
		);
	} finally {
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		rmSync(project, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
