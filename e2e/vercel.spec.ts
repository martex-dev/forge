import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(120_000);

const now = Date.now();
const project = {
	id: 'prj_1',
	name: 'market-calendar',
	framework: 'nextjs',
	updatedAt: now,
	link: { type: 'github', org: 'martex-dev', repo: 'market-calendar' },
	targets: {
		production: { id: 'dpl_live', url: 'mc.vercel.app', readyState: 'READY', createdAt: now },
	},
};
const deployment = (uid: string, state: string, target: string | null, message: string) => ({
	uid,
	name: 'market-calendar',
	url: `${uid}.vercel.app`,
	state,
	target,
	created: now - 60_000,
	projectId: 'prj_1',
	creator: { username: 'marto' },
	meta: { githubCommitMessage: message, githubCommitRef: 'main', githubCommitSha: 'abc' },
	inspectorUrl: 'https://vercel.com/x',
});

/** Minimal Vercel REST fixtures; records every request for assertions. */
function mockVercel(requests: string[]): Server {
	return createServer((req, res) => {
		const path = (req.url ?? '').split('?')[0] ?? '';
		requests.push(`${req.method} ${path} ${String(req.headers.authorization ?? '')}`);
		const json = (body: unknown, status = 200): void => {
			res.writeHead(status, { 'content-type': 'application/json' });
			res.end(JSON.stringify(body));
		};
		if (path === '/v2/user') return json({ user: { username: 'marto' } });
		if (path === '/v2/teams') return json({ teams: [] });
		if (path === '/v9/projects') return json({ projects: [project] });
		if (path === '/v9/projects/prj_1') return json(project);
		if (path === '/v6/deployments') {
			return json({
				deployments: [
					deployment('dpl_prev', 'READY', null, 'feat: earnings tab'),
					deployment('dpl_live', 'READY', 'production', 'fix: nfp time'),
					deployment('dpl_old', 'READY', 'production', 'chore: old release'),
					deployment('dpl_err', 'ERROR', null, 'wip: broken build'),
				],
			});
		}
		if (path === '/v3/deployments/dpl_prev/events') {
			return json([
				{ type: 'command', created: now, text: 'npm run build' },
				{ type: 'stdout', payload: { text: 'Compiled successfully', date: now } },
			]);
		}
		if (path.endsWith('/runtime-logs')) {
			res.writeHead(200, { 'content-type': 'application/stream+json' });
			res.end(
				'{"level":"info","message":"hello","timestampInMs":1,"requestMethod":"GET","requestPath":"/api/x","responseStatusCode":200}\n',
			);
			return;
		}
		if (req.method === 'POST' && (path.includes('/promote/') || path.includes('/rollback/'))) {
			return json({}, 201);
		}
		json({ error: { message: 'not found' } }, 404);
	});
}

test('Vercel: connect, projects, deployments, logs, and confirmed promote', async () => {
	const requests: string[] = [];
	const server = mockVercel(requests);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = (server.address() as AddressInfo).port;
	const userData = mkdtempSync(join(tmpdir(), 'forge-vercel-'));
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${userData}`],
		env: {
			...process.env,
			FORGE_NO_SIDECAR: '1',
			FORGE_E2E: '1',
			FORGE_VERCEL_API: `http://127.0.0.1:${port}`,
		},
	});
	try {
		const page = await app.firstWindow();
		await page.locator('[data-room-layout="build"]').waitFor({ state: 'attached' });
		await page.locator('[data-room-layout="build"] .dv-tab', { hasText: /^Vercel$/ }).click();
		await expect(page.getByText('Connect Vercel')).toBeVisible({ timeout: 20_000 });

		await page.evaluate(() =>
			window.forge.invoke('secrets:set', { key: 'vercel.token', value: 'vercel-test-token' }),
		);
		const panel = page.locator('[data-vercel]');
		await panel.locator('[data-project="market-calendar"]').click({ timeout: 20_000 });
		await expect(panel.locator('[data-deployment="dpl_live"]')).toContainText('current');
		await expect(panel.locator('[data-deployment="dpl_err"]')).toHaveAttribute(
			'data-state',
			'ERROR',
		);
		expect(requests.some((r) => r.includes('Bearer vercel-test-token'))).toBe(true);

		await panel.locator('[data-deployment="dpl_prev"]').click();
		const detail = page.locator('[data-deployment-detail="dpl_prev"]');
		await expect(detail.getByRole('log', { name: 'Build logs' })).toContainText(
			'Compiled successfully',
		);

		// Promote asks first; cancelling sends nothing.
		await detail.getByRole('button', { name: 'Promote to production…' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toContainText('Promote to production?');
		await expect(dialog).toContainText('dpl_prev.vercel.app');
		await dialog.getByRole('button', { name: 'Cancel' }).click();
		expect(requests.filter((r) => r.startsWith('POST'))).toEqual([]);

		await detail.getByRole('button', { name: 'Promote to production…' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Promote' }).click();
		await expect
			.poll(() => requests.filter((r) => r.startsWith('POST')).map((r) => r.split(' ')[1]))
			.toEqual(['/v10/projects/prj_1/promote/dpl_prev']);
		await expect(page.getByText('Promotion started')).toBeVisible();

		await detail.getByRole('tab', { name: 'Runtime logs' }).click();
		await expect(detail.getByRole('log', { name: 'Runtime logs' })).toContainText(
			'GET /api/x 200 · hello',
		);
	} finally {
		await app.close();
		server.close();
		rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
