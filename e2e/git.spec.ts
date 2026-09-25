import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { expect, test } from './fixtures';

test.setTimeout(90_000);

test('source control: see a change, diff it, stage and commit', async ({ page }) => {
	const repo = mkdtempSync(join(tmpdir(), 'forge-git-e2e-'));
	const git = (...args: string[]): string =>
		execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
	git('init', '-q', '-b', 'main');
	git('config', 'user.email', 'e2e@forge.local');
	git('config', 'user.name', 'Forge E2E');
	writeFileSync(join(repo, 'notes.md'), '# notes\n');
	git('add', '.');
	git('commit', '-q', '-m', 'init');
	writeFileSync(join(repo, 'notes.md'), '# notes\nnew line\n');

	try {
		await page.evaluate((p) => window.forge.invoke('workspace:open', p), repo);
		await expect(page.locator('[data-git-branch="main"]')).toBeVisible({ timeout: 15_000 });

		await page.getByRole('tab', { name: 'Source Control' }).click();
		const changes = page.getByRole('region', { name: 'Changes' });
		await expect(changes.getByText('notes.md')).toBeVisible();

		// Diff opens in a Monaco diff editor with both sides.
		await changes
			.getByRole('button', { name: /notes\.md/ })
			.first()
			.click();
		const diffHost = page.locator('[data-diff-host] .monaco-diff-editor');
		await expect(diffHost).toBeVisible({ timeout: 45_000 });
		await expect(diffHost).toContainText('new line');

		await changes.getByRole('button', { name: 'Stage notes.md' }).click();
		const staged = page.getByRole('region', { name: 'Staged Changes' });
		await expect(staged.getByText('notes.md')).toBeVisible();

		await page.getByRole('textbox', { name: 'Commit message' }).fill('e2e: add a line');
		await page.keyboard.press('Control+Enter');
		await expect(page.getByText('No changes. Working tree is clean.')).toBeVisible();
		expect(git('log', '-1', '--pretty=%s').trim()).toBe('e2e: add a line');
	} finally {
		await page.evaluate(() => window.forge.invoke('workspace:close'));
		rmSync(repo, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
