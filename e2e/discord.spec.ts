import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type IncomingMessage } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(120_000);

const body = (req: IncomingMessage): Promise<string> =>
	new Promise((resolve) => {
		let data = '';
		req.on('data', (c: Buffer) => (data += c.toString()));
		req.on('end', () => resolve(data));
	});

test('discord: add a webhook, post, and forward matching notifications', async () => {
	const posts: Array<{ content?: string; embeds?: Array<{ title: string }> }> = [];
	const server = createServer((req, res) => {
		if (req.method === 'GET') {
			res.writeHead(200, { 'content-type': 'application/json' });
			res.end(JSON.stringify({ name: 'Forge bot', channel_id: '42' }));
			return;
		}
		void body(req).then((b) => {
			posts.push(JSON.parse(b) as (typeof posts)[number]);
			res.writeHead(204).end();
		});
	});
	await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
	const port = (server.address() as AddressInfo).port;
	const dir = mkdtempSync(join(tmpdir(), 'forge-discord-'));
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${dir}`],
		env: {
			...process.env,
			FORGE_NO_SIDECAR: '1',
			FORGE_E2E: '1',
			FORGE_DISCORD_API: `http://127.0.0.1:${port}`,
		},
	});
	try {
		const page = await app.firstWindow();
		await page.locator('[data-room-layout="build"]').waitFor();
		await page.keyboard.press('Control+4');
		await page.keyboard.press('Control+K');
		await page.keyboard.type('Discord Webhooks');
		await page.keyboard.press('Enter');
		const panel = page.locator('[data-discord]');
		await panel.getByRole('textbox', { name: 'Webhook name' }).fill('#alerts');
		const url = panel.getByRole('textbox', { name: 'Webhook URL' });
		await url.fill('https://evil.com/api/webhooks/1/x');
		await expect(panel.getByRole('button', { name: 'Check & add' })).toBeDisabled();
		await url.fill('https://discord.com/api/webhooks/123/token-abc');
		await panel.getByRole('button', { name: 'Check & add' }).click();
		const card = panel.locator('[data-webhook="#alerts"]');
		await expect(card).toContainText('posts as “Forge bot”');

		// The URL never comes back to the renderer.
		const listed = JSON.stringify(
			await page.evaluate(() => window.forge.invoke('discord:list')),
		);
		expect(listed).not.toContain('token-abc');

		await panel.getByRole('textbox', { name: 'Message' }).fill('hello from Forge');
		await panel.getByRole('button', { name: 'Send' }).click();
		await expect.poll(() => posts.map((p) => p.content)).toContain('hello from Forge');

		// Forward warn/error (the default levels) once enabled; info stays local.
		await card.getByRole('switch', { name: 'Forward notifications to #alerts' }).click();
		await expect(card.getByRole('group', { name: 'Levels' })).toBeVisible();
		await page.evaluate(async () => {
			await window.forge.invoke('notifications:add', {
				module: 'runs',
				title: 'Loss diverged',
				level: 'error',
			});
			await window.forge.invoke('notifications:add', {
				module: 'runs',
				title: 'FYI only',
				level: 'info',
			});
		});
		await expect
			.poll(() => posts.flatMap((p) => p.embeds?.map((e) => e.title) ?? []))
			.toEqual(['Loss diverged']);
	} finally {
		await app.close();
		server.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
