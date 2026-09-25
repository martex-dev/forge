import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(120_000);

const REPO = '/repos/martex-dev/forge';
const now = new Date().toISOString();
const pull = {
	number: 12,
	title: 'Add candlestick chart',
	user: { login: 'alice', avatar_url: null },
	state: 'open',
	draft: false,
	merged_at: null,
	head: { ref: 'phase-1/trade', sha: 'abc123' },
	base: { ref: 'main' },
	created_at: now,
	updated_at: now,
	comments: 2,
	labels: [{ name: 'trade', color: 'a3ff12' }],
	html_url: 'https://github.com/martex-dev/forge/pull/12',
	requested_reviewers: [{ login: 'marto' }],
};

/** Minimal GitHub REST fixtures: just the endpoints Forge's GitHub module reads. */
function mockGitHub(auth: string[]): Server {
	const routes: Record<string, unknown> = {
		'/user': { login: 'marto' },
		[REPO]: {
			html_url: 'https://github.com/martex-dev/forge',
			default_branch: 'main',
			private: true,
		},
		[`${REPO}/pulls`]: [pull],
		[`${REPO}/pulls/12`]: {
			...pull,
			body: 'Adds **lightweight-charts**. Closes #3.',
			mergeable: true,
			additions: 3,
			deletions: 1,
			changed_files: 1,
		},
		[`${REPO}/pulls/12/files`]: [
			{
				filename: 'src/chart.ts',
				status: 'modified',
				additions: 3,
				deletions: 1,
				patch: '@@ -1,2 +1,4 @@\n import x from "y";\n-const old = 1;\n+const candles = [];\n+const volume = [];\n+export { candles };',
			},
		],
		[`${REPO}/commits/abc123/check-runs`]: {
			total_count: 2,
			check_runs: [
				{
					name: 'App (TypeScript)',
					status: 'completed',
					conclusion: 'failure',
					html_url: 'https://github.com/x',
				},
				{
					name: 'Sidecar (Python)',
					status: 'completed',
					conclusion: 'success',
					html_url: null,
				},
			],
		},
		[`${REPO}/commits/abc123/status`]: { statuses: [] },
		[`${REPO}/issues`]: [
			{
				number: 3,
				title: 'Chart should show volume',
				user: { login: 'marto' },
				state: 'open',
				created_at: now,
				updated_at: now,
				comments: 0,
				labels: [],
				assignees: [],
				html_url: 'https://github.com/martex-dev/forge/issues/3',
			},
			{ ...pull, comments: 0, pull_request: {} },
		],
		[`${REPO}/actions/runs`]: {
			total_count: 1,
			workflow_runs: [
				{
					id: 99,
					name: 'CI',
					display_title: 'feat(trade): add chart',
					event: 'push',
					status: 'completed',
					conclusion: 'failure',
					head_branch: 'phase-1/trade',
					head_sha: 'abc123',
					actor: { login: 'marto' },
					run_number: 41,
					created_at: now,
					updated_at: now,
					html_url: 'https://github.com/martex-dev/forge/actions/runs/99',
				},
			],
		},
	};
	return createServer((req, res) => {
		auth.push(String(req.headers.authorization ?? ''));
		const path = (req.url ?? '').split('?')[0] ?? '';
		const body = routes[path];
		res.writeHead(body === undefined ? 404 : 200, { 'content-type': 'application/json' });
		res.end(JSON.stringify(body ?? { message: 'Not Found' }));
	});
}

test('GitHub: connect flow, pull requests with checks and diff, issues, Actions', async () => {
	const auth: string[] = [];
	const server = mockGitHub(auth);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = (server.address() as AddressInfo).port;
	const userData = mkdtempSync(join(tmpdir(), 'forge-gh-e2e-'));
	const project = mkdtempSync(join(tmpdir(), 'forge-gh-repo-'));
	execFileSync('git', ['-C', project, 'init', '-q']);
	execFileSync('git', [
		'-C',
		project,
		'remote',
		'add',
		'origin',
		'https://github.com/martex-dev/forge.git',
	]);
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${userData}`],
		env: {
			...process.env,
			FORGE_NO_SIDECAR: '1',
			FORGE_E2E: '1',
			FORGE_GITHUB_API: `http://127.0.0.1:${port}`,
		},
	});
	try {
		const page = await app.firstWindow();
		await page.locator('[data-room-layout="build"]').waitFor({ state: 'attached' });
		await page.evaluate((p) => window.forge.invoke('workspace:open', p), project);
		await page.locator('[data-room-layout="build"] .dv-tab', { hasText: /^GitHub$/ }).click();

		// No token yet: the panel explains and links to Settings → Secrets.
		await expect(page.getByText('Connect martex-dev/forge')).toBeVisible({ timeout: 20_000 });
		await page.getByRole('button', { name: 'Open Settings → Secrets' }).click();
		await expect(page.getByRole('dialog').getByText('GitHub token')).toBeVisible();
		await page.keyboard.press('Escape');

		// Saving a token (normally typed into Settings) refreshes the panel.
		await page.evaluate(() =>
			window.forge.invoke('secrets:set', {
				key: 'github.token',
				value: 'test-token-not-real',
			}),
		);
		const panel = page.locator('[data-github="martex-dev/forge"]');
		const row = panel.locator('[data-pr="12"]');
		await expect(row).toContainText('Add candlestick chart', { timeout: 20_000 });
		await expect(row).toContainText('review');
		expect(auth.some((a) => a.includes('test-token-not-real'))).toBe(true);

		await row.click();
		const detail = page.locator('[data-pr-detail="12"]');
		await expect(detail.getByRole('heading', { level: 2 })).toContainText(
			'Add candlestick chart',
		);
		await expect(detail.getByRole('region', { name: 'Checks' })).toContainText('1 failing');
		await expect(detail.locator('strong', { hasText: 'lightweight-charts' })).toBeVisible();
		await expect(detail.locator('[data-pr-file="src/chart.ts"]')).toContainText(
			'const candles = [];',
		);

		await panel.getByRole('tab', { name: 'Issues' }).click();
		await expect(panel.locator('[data-issue="3"]')).toContainText('Chart should show volume');
		await expect(panel.locator('[data-issue="12"]')).toHaveCount(0);

		await panel.getByRole('tab', { name: 'Actions' }).click();
		await expect(panel.locator('[data-run-id="99"]')).toContainText('failure');
	} finally {
		await app.close();
		server.close();
		rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		rmSync(project, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
