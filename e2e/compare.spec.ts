import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(240_000);

function demo(userDataDir: string, name: string, steps: number): ChildProcess {
	return spawn(
		'uv',
		[
			'run',
			'--project',
			'packages/forge-probe',
			'python',
			'examples/probe_demo.py',
			'--steps',
			String(steps),
			'--delay',
			'0.01',
			'--name',
			name,
		],
		{
			env: { ...process.env, FORGE_PROBE_FILE: join(userDataDir, 'sidecar', 'probe.json') },
			stdio: 'ignore',
			windowsHide: true,
		},
	);
}

test('compare runs: config diff, best final metric, overlaid curves', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-compare-'));
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${dir}`],
		env: { ...process.env, FORGE_E2E: '1' },
	});
	const children: ChildProcess[] = [];
	try {
		const page = await app.firstWindow();
		await expect(page.locator('[data-sidecar-state]')).toHaveAttribute(
			'data-sidecar-state',
			'ready',
			{ timeout: 120_000 },
		);
		await page.keyboard.press('Control+3');
		children.push(demo(dir, 'baseline', 60));
		await expect(page.locator('[data-run]', { hasText: 'baseline' })).toHaveAttribute(
			'data-run-status',
			'finished',
			{ timeout: 60_000 },
		);
		children.push(demo(dir, 'longer', 120));
		await expect(page.locator('[data-run]', { hasText: 'longer' })).toHaveAttribute(
			'data-run-status',
			'finished',
			{ timeout: 60_000 },
		);

		// Newest run selected → compare with the earlier run of the same project.
		await page.getByRole('button', { name: 'Compare with an earlier run…' }).click();
		const panel = page.locator('[data-compare]');
		await expect(panel.locator('[data-compare-run]')).toHaveCount(2);

		const loss = panel.locator('[data-compare-metric="train/loss"]');
		await expect(loss).toBeVisible({ timeout: 20_000 });
		await expect(loss.locator('[data-best]')).toHaveCount(1);

		// Only the differing config key shows until the switch is flipped.
		const config = panel.locator('[data-compare-config]');
		await expect(config).toContainText('steps');
		await expect(config).not.toContainText('model.layers');
		await panel.getByRole('switch', { name: 'Only differences' }).click();
		await expect(config).toContainText('model.layers');

		await expect(panel.locator('[data-compare-chart="train/loss"]')).toBeVisible();
		await panel.getByRole('button', { name: 'Remove baseline' }).click();
		await expect(panel.getByText('Add another run')).toBeVisible();
	} finally {
		for (const child of children) child.kill();
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
