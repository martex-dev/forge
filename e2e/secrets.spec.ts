import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

const SECRET = 'sk-e2e-ThisMustNeverLeak-7f3a9c';

function allFiles(dir: string): string[] {
	if (!existsSync(dir)) return [];
	return readdirSync(dir).flatMap((name) => {
		const full = join(dir, name);
		return statSync(full).isDirectory() ? allFiles(full) : [full];
	});
}

test('a saved secret survives restart and never leaks to logs, DB or renderer', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-secrets-e2e-'));
	const launch = () =>
		electron.launch({
			args: ['.', `--user-data-dir=${dir}`],
			env: { ...process.env, FORGE_NO_SIDECAR: '1', FORGE_E2E: '1' },
		});
	try {
		const first = await launch();
		const page1 = await first.firstWindow();
		const responses = await page1.evaluate(async (secret) => {
			const f = window.forge;
			return [
				await f.invoke('secrets:set', { key: 'e2e.test', value: secret }),
				// Error paths that log: unknown key and a channel that doesn't exist.
				await f.invoke('secrets:set', { key: 'not.declared', value: secret }),
				await (f.invoke as (c: string, i: unknown) => Promise<unknown>)(
					'secrets:get',
					'e2e.test',
				),
				await f.invoke('secrets:has', 'e2e.test'),
				await f.invoke('secrets:listSaved'),
			];
		}, SECRET);
		expect(responses[0]).toEqual({ ok: true });
		expect(responses[1]).toMatchObject({ ok: false, error: { code: 'SECRET_UNKNOWN_KEY' } });
		expect(responses[2]).toMatchObject({ ok: false, error: { code: 'UNKNOWN_CHANNEL' } });
		expect(responses[3]).toEqual({ ok: true, data: true });
		expect(JSON.stringify(responses)).not.toContain(SECRET);

		const rendererDump = await page1.evaluate(
			() => document.documentElement.outerHTML + JSON.stringify(localStorage),
		);
		expect(rendererDump).not.toContain(SECRET);
		await first.close();

		// Restart: still saved.
		const second = await launch();
		const page2 = await second.firstWindow();
		const has = await page2.evaluate(() => window.forge.invoke('secrets:has', 'e2e.test'));
		expect(has).toEqual({ ok: true, data: true });
		await second.close();

		// Nothing on disk (logs, SQLite incl. WAL, secrets file) contains the plaintext.
		const files = allFiles(dir).filter(
			(f) => !/[\\/](Cache|Code Cache|GPUCache|DawnCache)[\\/]/.test(f),
		);
		expect(files.some((f) => f.endsWith('main.log'))).toBe(true);
		expect(files.some((f) => f.endsWith('secrets.json'))).toBe(true);
		for (const file of files) {
			const bytes = readFileSync(file);
			expect(bytes.includes(Buffer.from(SECRET, 'utf8')), file).toBe(false);
			expect(bytes.includes(Buffer.from(SECRET, 'utf16le')), file).toBe(false);
		}
	} finally {
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
