/**
 * Startup and idle-memory benchmark for the built app (`npm run build` first).
 *   npx tsx scripts/measure-startup.mts [runs]
 * Fresh profile per run, sidecar off (it starts after the window and would only add noise).
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron } from '@playwright/test';

interface Sample {
	window: number;
	shell: number;
	editorRoomReady: number;
	memoryMb: number;
}

async function once(): Promise<Sample> {
	const dir = mkdtempSync(join(tmpdir(), 'forge-bench-'));
	const t0 = performance.now();
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${dir}`],
		env: { ...process.env, FORGE_NO_SIDECAR: '1' },
	});
	try {
		const page = await app.firstWindow();
		const window = performance.now() - t0;
		await page
			.locator('[data-room-layout="build"]')
			.waitFor({ state: 'visible', timeout: 60_000 });
		const shell = performance.now() - t0;
		await page
			.locator('[data-room-layout="build"] .dv-tab')
			.first()
			.waitFor({ timeout: 60_000 });
		const editorRoomReady = performance.now() - t0;
		await page.waitForTimeout(8_000); // settle, then measure idle memory
		const metrics = await app.evaluate(({ app: a }) => a.getAppMetrics());
		const memoryMb = metrics.reduce((sum, m) => sum + m.memory.workingSetSize, 0) / 1024;
		return { window, shell, editorRoomReady, memoryMb };
	} finally {
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
}

const runs = Number(process.argv[2] ?? 3);
const samples: Sample[] = [];
for (let i = 0; i < runs; i++) samples.push(await once());
const median = (k: keyof Sample): number => {
	const v = samples.map((s) => s[k]).sort((a, b) => a - b);
	return v[Math.floor(v.length / 2)] ?? 0;
};
process.stdout.write(
	`${JSON.stringify({
		runs,
		windowMs: Math.round(median('window')),
		shellMs: Math.round(median('shell')),
		editorRoomReadyMs: Math.round(median('editorRoomReady')),
		idleMemoryMb: Math.round(median('memoryMb')),
	})}\n`,
);
