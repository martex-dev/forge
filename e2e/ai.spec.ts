import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

test.setTimeout(150_000);

const ORIGINAL = 'def add(a, b):\n    return a - b\n\n\nprint(add(1, 2))\n';
const REPLY = [
	'The subtraction is a bug. Fixed:\n',
	'```python\ndef add(a, b):\n',
	'    return a + b\n```\n',
	'That returns **3**.',
];

interface Captured {
	apiKey: string;
	body: { system: string; model: string; messages: Array<{ role: string; content: string }> };
}

/** Speaks the Anthropic Messages streaming protocol, in several chunks with small delays. */
function mockAnthropic(captured: Captured[]): Server {
	return createServer((req, res) => {
		let raw = '';
		req.on('data', (c: Buffer) => (raw += c.toString('utf8')));
		req.on('end', () => {
			captured.push({
				apiKey: String(req.headers['x-api-key'] ?? ''),
				body: JSON.parse(raw) as Captured['body'],
			});
			res.writeHead(200, { 'content-type': 'text/event-stream' });
			const events = [
				[
					'message_start',
					{ type: 'message_start', message: { usage: { input_tokens: 42 } } },
				],
				...REPLY.map((text) => [
					'content_block_delta',
					{ type: 'content_block_delta', delta: { type: 'text_delta', text } },
				]),
				['message_delta', { type: 'message_delta', usage: { output_tokens: 17 } }],
				['message_stop', { type: 'message_stop' }],
			] as const;
			let i = 0;
			const next = (): void => {
				const e = events[i++];
				if (!e) return void res.end();
				res.write(`event: ${e[0]}\ndata: ${JSON.stringify(e[1])}\n\n`);
				setTimeout(next, 40);
			};
			next();
		});
	});
}

test('AI chat: selection context, streamed reply, diff-preview apply without saving', async () => {
	const captured: Captured[] = [];
	const server = mockAnthropic(captured);
	await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
	const port = (server.address() as AddressInfo).port;
	const userData = mkdtempSync(join(tmpdir(), 'forge-ai-'));
	const project = mkdtempSync(join(tmpdir(), 'forge-ai-proj-'));
	writeFileSync(join(project, 'calc.py'), ORIGINAL);
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${userData}`],
		env: {
			...process.env,
			FORGE_NO_SIDECAR: '1',
			FORGE_E2E: '1',
			FORGE_AI_API: `http://127.0.0.1:${port}`,
		},
	});
	try {
		const page = await app.firstWindow();
		await page.locator('[data-room-layout="build"]').waitFor({ state: 'attached' });
		await page.evaluate((p) => window.forge.invoke('workspace:open', p), project);
		await page
			.getByRole('tree', { name: 'Files' })
			.getByRole('treeitem', { name: /calc\.py/ })
			.click();
		const editor = page.locator('[data-editor-host] .monaco-editor');
		await expect(editor).toBeVisible({ timeout: 45_000 });

		const chat = page.locator('[data-ai-chat]');
		await expect(chat.getByText('No Claude API key yet.')).toBeVisible();
		await page.evaluate(() =>
			window.forge.invoke('secrets:set', { key: 'anthropic.key', value: 'sk-ant-test' }),
		);
		await expect(chat.getByText('No Claude API key yet.')).toHaveCount(0);

		// Select the two function lines and attach them.
		await editor.locator('.view-line').first().click();
		await page.keyboard.press('Home');
		await page.keyboard.press('Shift+ArrowDown');
		await page.keyboard.press('Shift+End');
		await chat.getByRole('button', { name: 'Selection' }).click();
		await expect(chat.locator('[data-attached="selection"]')).toContainText('calc.py:1-2');

		await chat.getByRole('textbox', { name: 'Message' }).fill('Why does add() return -1?');
		await page.keyboard.press('Enter');
		const reply = chat.locator('[data-chat-role="assistant"]').last();
		await expect(reply).toHaveAttribute('data-streaming', 'false', { timeout: 20_000 });
		await expect(reply.locator('strong', { hasText: '3' })).toBeVisible();
		await expect(reply).toContainText('42 in / 17 out');

		expect(captured).toHaveLength(1);
		expect(captured[0]?.apiKey).toBe('sk-ant-test');
		expect(captured[0]?.body.model).toBe('claude-opus-5-5');
		expect(captured[0]?.body.system).toContain('label="calc.py:1-2"');
		expect(captured[0]?.body.system).toContain('return a - b');
		expect(captured[0]?.body.messages).toEqual([
			{ role: 'user', content: 'Why does add() return -1?' },
		]);

		// Apply goes through a diff preview; accepting edits the buffer but doesn't save.
		await reply.locator('[data-code-block]').getByRole('button', { name: 'Apply…' }).click();
		const preview = page.locator('[data-apply-preview="calc.py"]');
		await expect(preview).toBeVisible();
		await expect(preview.getByRole('button', { name: 'Replace lines 1-2' })).toHaveAttribute(
			'aria-pressed',
			'true',
		);
		await preview.getByRole('button', { name: 'Accept' }).click();
		await expect(editor.locator('.view-lines')).toContainText('return a + b', {
			timeout: 10_000,
		});
		await expect(editor.locator('.view-lines')).toContainText('print(add(1, 2))');
		expect(readFileSync(join(project, 'calc.py'), 'utf8')).toBe(ORIGINAL);
		await expect(
			page.getByRole('tab', { name: /calc\.py/ }).getByRole('button', { name: /unsaved/ }),
		).toBeVisible();
	} finally {
		await app.close();
		server.close();
		rmSync(userData, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		rmSync(project, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
