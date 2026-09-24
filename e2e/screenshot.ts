/**
 * Dev helper (not a test): launches the built app and saves a screenshot.
 * Usage: npx tsx e2e/screenshot.ts <out.png> [room]
 */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron } from '@playwright/test';

async function main(): Promise<void> {
	const out = process.argv[2] ?? 'screenshot.png';
	const userDataDir =
		process.env['FORGE_SHOT_USERDATA'] ?? mkdtempSync(join(tmpdir(), 'forge-shot-'));
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${userDataDir}`],
		env: { ...process.env, FORGE_E2E: '1' },
	});
	const page = await app.firstWindow();
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.waitForTimeout(Number(process.env['FORGE_SHOT_WAIT'] ?? 1500));
	const script = process.env['FORGE_SHOT_SCRIPT'];
	if (script) {
		await page.evaluate(script);
		await page.waitForTimeout(800);
	}
	await page.screenshot({ path: out });
	await app.close();
}

void main();
