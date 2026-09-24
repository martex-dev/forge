import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, test } from '@playwright/test';

async function launch(userDataDir: string): ReturnType<typeof electron.launch> {
	return electron.launch({
		args: ['.', `--user-data-dir=${userDataDir}`],
		env: { ...process.env, FORGE_NO_SIDECAR: '1', FORGE_E2E: '1' },
	});
}

test('settings persist across restarts', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-persist-'));
	try {
		const first = await launch(dir);
		const page1 = await first.firstWindow();
		const saved = await page1.evaluate(() =>
			window.forge.invoke('settings:updateGeneral', { fontSize: 14 }),
		);
		expect(saved).toMatchObject({ ok: true, data: { fontSize: 14 } });
		await first.close();

		const second = await launch(dir);
		const page2 = await second.firstWindow();
		const loaded = await page2.evaluate(() => window.forge.invoke('settings:getGeneral'));
		expect(loaded).toMatchObject({ ok: true, data: { fontSize: 14 } });
		await second.close();
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
