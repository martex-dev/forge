import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(240_000);

// The sidecar's own venv has ipykernel (dev dependency), so it serves as "your environment".
const PYTHON = resolve(
	'sidecar',
	'.venv',
	process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);

test('notebooks: kernel from metadata, run all, errors, autosave in Jupyter format', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-nb-'));
	const path = join(dir, 'analysis.ipynb');
	writeFileSync(
		path,
		JSON.stringify({
			cells: [
				{ cell_type: 'markdown', id: 'm1', metadata: {}, source: ['# Hello **notebook**'] },
				{
					cell_type: 'code',
					id: 'c1',
					metadata: {},
					source: ['x = 21\n', "print('half')"],
					outputs: [],
					execution_count: null,
				},
				{
					cell_type: 'code',
					id: 'c2',
					metadata: {},
					source: ['x * 2'],
					outputs: [],
					execution_count: null,
				},
			],
			metadata: { forge: { python: PYTHON } },
			nbformat: 4,
			nbformat_minor: 5,
		}),
	);

	const app = await electron.launch({
		args: ['.', `--user-data-dir=${join(dir, 'profile')}`],
		env: { ...process.env, FORGE_E2E: '1' },
	});
	try {
		const page = await app.firstWindow();
		await expect(page.locator('[data-sidecar-state]')).toHaveAttribute(
			'data-sidecar-state',
			'ready',
			{
				timeout: 120_000,
			},
		);
		// Reading it once puts it in Recent (the file dialog can't be driven here).
		await page.evaluate((p) => window.forge.invoke('nb:read', p), path);
		await page.keyboard.press('Control+3');
		await page.keyboard.press('Control+K');
		await page.keyboard.type('Lab: Notebooks');
		await page.keyboard.press('Enter');
		await page
			.getByRole('list', { name: 'Recent notebooks' })
			.getByText('analysis.ipynb')
			.click();

		const nb = page.locator(`[data-nb-path="${path.replace(/\\/g, '\\\\')}"]`);
		await expect(nb.locator('h1')).toHaveText('Hello notebook');
		await expect(nb.locator('[data-nb-kernel="idle"]')).toBeVisible({ timeout: 60_000 });

		await nb.getByRole('button', { name: 'Run all' }).click();
		const code1 = nb.locator('[data-nb-cell="1"]');
		const code2 = nb.locator('[data-nb-cell="2"]');
		await expect(code1.locator('[data-nb-outputs]')).toContainText('half', { timeout: 30_000 });
		await expect(code2.locator('[data-nb-outputs]')).toContainText('42');
		await expect(code2).toContainText('[2]');

		// Edit + Ctrl+Enter: the error shows, and autosave writes it to disk.
		const editor = code2.getByRole('textbox');
		await editor.fill('1 / 0');
		await editor.press('Control+Enter');
		await expect(code2.locator('[data-nb-error="ZeroDivisionError"]')).toBeVisible({
			timeout: 30_000,
		});
		await expect(nb.locator('[data-nb-save="Saved"]')).toBeVisible({ timeout: 15_000 });
		const saved = JSON.parse(readFileSync(path, 'utf8')) as {
			cells: Array<{
				source: string[];
				outputs?: Array<{ output_type: string; ename?: string }>;
			}>;
		};
		expect(saved.cells[2]?.source).toEqual(['1 / 0']);
		expect(saved.cells[2]?.outputs?.[0]).toMatchObject({
			output_type: 'error',
			ename: 'ZeroDivisionError',
		});
		expect(saved.cells[1]?.outputs?.[0]).toMatchObject({ output_type: 'stream' });
		expect(readFileSync(path, 'utf8')).toContain('\n "cells": [');

		// Shift+Enter in the last cell adds a new one below and moves there.
		await editor.press('Shift+Enter');
		await expect(nb.locator('[data-nb-cell]')).toHaveCount(4);
	} finally {
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
