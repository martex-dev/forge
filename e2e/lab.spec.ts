import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, type Page, test } from '@playwright/test';

test.setTimeout(240_000);

/** Runs examples/probe_demo.py with the probe pointed at this test's sidecar. */
function demo(userDataDir: string, args: string[]): ChildProcess {
	return spawn(
		'uv',
		['run', '--project', 'packages/forge-probe', 'python', 'examples/probe_demo.py', ...args],
		{
			env: { ...process.env, FORGE_PROBE_FILE: join(userDataDir, 'sidecar', 'probe.json') },
			stdio: 'ignore',
			windowsHide: true,
		},
	);
}

async function openLab(page: Page): Promise<void> {
	await expect(page.locator('[data-sidecar-state]')).toHaveAttribute(
		'data-sidecar-state',
		'ready',
		{ timeout: 120_000 },
	);
	await page.keyboard.press('Control+3');
	await expect(page.locator('[data-room-layout="lab"]')).toBeVisible();
}

test('forge-probe streams a run into the Run Monitor; failures and GPU are shown', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-lab-'));
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${dir}`],
		env: { ...process.env, FORGE_E2E: '1' },
	});
	const children: ChildProcess[] = [];
	try {
		const page = await app.firstWindow();
		await openLab(page);

		// Empty state explains how to install the probe from this repo.
		await expect(page.getByText('No runs yet')).toBeVisible({ timeout: 30_000 });
		await expect(page.getByText(/pip install -e ".*forge-probe"/)).toBeVisible();

		children.push(demo(dir, ['--steps', '200', '--delay', '0.05', '--name', 'e2e-demo']));
		const row = page.locator('[data-run]', { hasText: 'e2e-demo' });
		await expect(row).toBeVisible({ timeout: 30_000 });
		const view = page.locator('[data-run-view]');
		await expect(view.getByRole('heading', { name: 'e2e-demo' })).toBeVisible();
		// train/loss + val/loss share one chart; lr and acc get their own.
		for (const title of ['loss', 'lr', 'acc']) {
			await expect(view.locator(`[data-metric-chart="${title}"]`)).toBeVisible({
				timeout: 20_000,
			});
		}
		await expect(view.getByText('Config (4)')).toBeVisible();
		await expect(row).toHaveAttribute('data-run-status', 'finished', { timeout: 60_000 });
		await expect(view.locator('[data-metric-last="val/acc"]')).not.toHaveText('NaN');

		children.push(
			demo(dir, [
				'--steps',
				'50',
				'--delay',
				'0.01',
				'--name',
				'e2e-crash',
				'--fail-at',
				'5',
			]),
		);
		const crashed = page.locator('[data-run]', { hasText: 'e2e-crash' });
		await expect(crashed).toHaveAttribute('data-run-status', 'failed', { timeout: 60_000 });
		await crashed.click();
		await expect(
			page.locator('[data-run-view]').getByText('RuntimeError: simulated failure at step 5'),
		).toBeVisible();
		// Main noticed both runs ending and posted inbox notifications (finished + failed).
		await expect(page.locator('footer [data-unread="2"]')).toBeVisible({ timeout: 15_000 });

		// GPU panel: real numbers on a machine with an NVIDIA GPU, a clear empty state otherwise.
		await expect(
			page.locator('[data-gpu]').or(page.getByText('No NVIDIA GPU detected')),
		).toBeVisible({ timeout: 20_000 });
	} finally {
		for (const child of children) child.kill();
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
