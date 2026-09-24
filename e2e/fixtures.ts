import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	_electron as electron,
	type ElectronApplication,
	type Page,
	test as base,
} from '@playwright/test';

interface ForgeFixtures {
	app: ElectronApplication;
	page: Page;
	userDataDir: string;
}

// Each test gets a throwaway userData dir so runs never touch Marto's real settings/DB.
export const test = base.extend<ForgeFixtures>({
	// Playwright parses the first param's destructuring to resolve fixture deps; `{}` means none.
	// eslint-disable-next-line no-empty-pattern
	userDataDir: async ({}, use) => {
		const dir = mkdtempSync(join(tmpdir(), 'forge-e2e-'));
		await use(dir);
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	},
	app: async ({ userDataDir }, use) => {
		const app = await electron.launch({
			args: ['.', `--user-data-dir=${userDataDir}`],
			env: { ...process.env, FORGE_NO_SIDECAR: '1', FORGE_E2E: '1' },
		});
		await use(app);
		await app.close();
	},
	page: async ({ app }, use) => {
		const page = await app.firstWindow();
		await page.waitForLoadState('domcontentloaded');
		await use(page);
	},
});

export { expect } from '@playwright/test';
