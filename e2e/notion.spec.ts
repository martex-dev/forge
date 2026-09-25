import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(120_000);

const ID = '0123456789abcdef0123456789abcdef';
const page = (id: string, title: string): Record<string, unknown> => ({
	id,
	url: `https://www.notion.so/${id}`,
	last_edited_time: new Date().toISOString(),
	icon: { type: 'emoji', emoji: '🧪' },
	parent: { type: 'workspace' },
	properties: { title: { type: 'title', title: [{ plain_text: title }] } },
});
const read = (req: IncomingMessage): Promise<string> =>
	new Promise((r) => {
		let d = '';
		req.on('data', (c: Buffer) => (d += c.toString()));
		req.on('end', () => r(d));
	});

test('notion: token gate, search, read, append a to-do, create a sub-page', async () => {
	const blocks: Array<Record<string, unknown>> = [
		{
			id: 'b1',
			type: 'heading_2',
			heading_2: { rich_text: [{ plain_text: 'Research plan' }] },
		},
	];
	const created: string[] = [];
	const server = createServer((req, res) => {
		void read(req).then((raw) => {
			const send = (body: unknown): void => {
				res.writeHead(200, { 'content-type': 'application/json' });
				res.end(JSON.stringify(body));
			};
			if (req.headers.authorization !== 'Bearer ntn_test')
				return void res.writeHead(401).end('{}');
			const url = req.url ?? '';
			if (req.method === 'POST' && url === '/search')
				return send({ results: [page(ID, 'Lab notebook')] });
			if (req.method === 'GET' && url.startsWith(`/pages/${ID}`))
				return send(page(ID, 'Lab notebook'));
			if (req.method === 'GET' && url.startsWith(`/blocks/${ID}/children`))
				return send({ results: blocks, has_more: false });
			if (req.method === 'PATCH' && url === `/blocks/${ID}/children`) {
				const body = JSON.parse(raw) as { children: Array<Record<string, unknown>> };
				// Like the real API, responses carry plain_text for every rich-text run.
				for (const [i, c] of body.children.entries()) {
					const type = String(c['type']);
					const inner = c[type] as { rich_text: Array<{ text: { content: string } }> };
					const rich_text = inner.rich_text.map((t) => ({
						...t,
						plain_text: t.text.content,
					}));
					blocks.push({ id: `n${i}`, type, [type]: { ...inner, rich_text } });
				}
				return send({ results: [] });
			}
			if (req.method === 'POST' && url === '/pages') {
				const body = JSON.parse(raw) as {
					properties: { title: { title: Array<{ text: { content: string } }> } };
				};
				const title = body.properties.title.title[0]?.text.content ?? '';
				created.push(title);
				return send(page('fedcba9876543210fedcba9876543210', title));
			}
			res.writeHead(404).end('{}');
		});
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	const dir = mkdtempSync(join(tmpdir(), 'forge-notion-'));
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${dir}`],
		env: {
			...process.env,
			FORGE_NO_SIDECAR: '1',
			FORGE_E2E: '1',
			FORGE_NOTION_API: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
		},
	});
	try {
		const win = await app.firstWindow();
		await win.locator('[data-room-layout="build"]').waitFor();
		await win.keyboard.press('Control+4');
		await win.keyboard.press('Control+K');
		await win.keyboard.type('Hub: Notion Pages');
		await win.keyboard.press('Enter');
		await expect(win.getByText('Connect Notion')).toBeVisible();

		// The token goes through the same IPC as Settings → Secrets.
		await win.evaluate(() =>
			window.forge.invoke('secrets:set', { key: 'notion.token', value: 'ntn_test' }),
		);
		const panel = win.locator('[data-notion]');
		await panel.locator('[data-notion-result="Lab notebook"]').click();
		const view = win.locator('[data-notion-page="Lab notebook"]');
		await expect(view.locator('h2', { hasText: 'Research plan' })).toBeVisible();

		await view.getByRole('textbox', { name: 'Append text' }).fill('rerun with purged CV');
		await view.getByRole('textbox', { name: 'Append text' }).press('Enter');
		await expect(view.getByText('rerun with purged CV')).toBeVisible();
		await expect(view.locator('.md-task')).toHaveCount(1);

		await view.getByRole('button', { name: 'New sub-page' }).click();
		await view.getByRole('textbox', { name: 'Sub-page title' }).fill('Experiment 12');
		await view.getByRole('button', { name: 'Create' }).click();
		await expect.poll(() => created).toEqual(['Experiment 12']);
	} finally {
		await app.close();
		server.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
