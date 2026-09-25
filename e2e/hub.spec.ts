import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, expect, type Page, test } from '@playwright/test';

test.setTimeout(180_000);

function makeVault(): string {
	const root = mkdtempSync(join(tmpdir(), 'forge-vault-'));
	const write = (rel: string, text: string): void => {
		const abs = join(root, ...rel.split('/'));
		mkdirSync(join(abs, '..'), { recursive: true });
		writeFileSync(abs, text);
	};
	write('Inbox.md', '# Inbox\n\nThinking about [[Forge]] #idea\n');
	write(
		'Projects/Forge.md',
		'---\ntags: [project]\n---\n# Forge\n\nAn Electron command center.\n',
	);
	write('.obsidian/daily-notes.json', JSON.stringify({ folder: 'Daily', format: 'YYYY-MM-DD' }));
	return root;
}

const today = (): string => {
	const d = new Date();
	const pad = (n: number): string => String(n).padStart(2, '0');
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

async function openHub(page: Page, vault: string): Promise<void> {
	await page.locator('[data-room-layout="hub"]').waitFor({ state: 'attached' });
	await page.keyboard.press('Control+4');
	await expect(page.locator('[data-room-layout="hub"]')).toBeVisible();
	await expect(page.getByText('Open your Obsidian vault')).toBeVisible();
	await page.evaluate((root) => window.forge.invoke('vault:open', root), vault);
	await expect(page.locator('[data-vault]')).toBeVisible();
}

test('Hub: vault browse/edit/links/search/tags, quick note, and inbox click-through', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-hub-'));
	const vault = makeVault();
	const app = await electron.launch({
		args: ['.', `--user-data-dir=${dir}`],
		env: { ...process.env, FORGE_NO_SIDECAR: '1', FORGE_E2E: '1' },
	});
	try {
		const page = await app.firstWindow();
		await openHub(page, vault);
		const sidebar = page.locator('[data-vault]');
		// The Hub room was hidden when its default layout was built; docked panels still get
		// their initial size (280 px) instead of a third of the window.
		const width = (await sidebar.boundingBox())?.width ?? 0;
		expect(width).toBeGreaterThan(240);
		expect(width).toBeLessThan(320);
		await expect(sidebar.getByText('2 notes')).toBeVisible();

		// Edit with autosave.
		await sidebar.locator('[data-vault-path="Inbox.md"]').click();
		const editor = page.locator('[data-note-editor="Inbox.md"] .monaco-editor');
		await expect(editor).toBeVisible({ timeout: 30_000 });
		await editor.click();
		await page.keyboard.press('Control+End');
		await page.keyboard.type('Autosaved line');
		// Autosave (debounced) writes the file; the header returns to "Saved".
		await expect
			.poll(() => readFileSync(join(vault, 'Inbox.md'), 'utf8'), { timeout: 10_000 })
			.toContain('Autosaved line');
		await expect(page.locator('[data-save-state="saved"]')).toBeVisible();

		// Preview: wikilink → Forge, which lists Inbox as a backlink.
		await page.getByRole('button', { name: 'Preview' }).click();
		const preview = page.locator('[data-note-preview="Inbox.md"]');
		await preview.locator('a[data-wikilink="Forge"]').click();
		const forge = page.locator(
			'[data-note-editor="Projects/Forge.md"], [data-note-preview="Projects/Forge.md"]',
		);
		await expect(forge).toBeVisible();
		const forgePreview = page.locator('[data-note-preview="Projects/Forge.md"]');
		await expect(
			forgePreview.getByRole('region', { name: 'Backlinks' }).getByText('Inbox'),
		).toBeVisible();

		// Obsidian (or sync) edits the file: the open note follows.
		writeFileSync(join(vault, 'Projects', 'Forge.md'), '# Forge\n\nEdited outside Forge.\n');
		await expect(forgePreview.getByText('Edited outside Forge.')).toBeVisible({
			timeout: 10_000,
		});

		// Search and tags.
		await sidebar.getByRole('tab', { name: 'Search' }).click();
		await sidebar.getByRole('textbox', { name: 'Search notes' }).fill('autosaved');
		await expect(sidebar.locator('[data-search-hit="Inbox.md"]')).toBeVisible();
		await sidebar.getByRole('tab', { name: 'Tags' }).click();
		await sidebar.locator('[data-tag-row="idea"]').click();
		await expect(
			sidebar.getByRole('list', { name: 'Notes tagged idea' }).getByText('Inbox'),
		).toBeVisible();

		// Quick note from anywhere (Build room) lands in today's daily note.
		await page.keyboard.press('Control+1');
		await page.keyboard.press('Control+Alt+N');
		const quick = page.getByRole('textbox', { name: 'Quick note text' });
		await expect(quick).toBeVisible();
		await quick.fill('Check the NFP print');
		await quick.press('Control+Enter');
		await expect(quick).toBeHidden();
		const daily = join(vault, 'Daily', `${today()}.md`);
		await expect
			.poll(() => existsSync(daily) && readFileSync(daily, 'utf8'))
			.toMatch(/^- \d\d:\d\d Check the NFP print\n$/);

		// Inbox: a module notification with a target; clicking it jumps to that panel.
		await page.evaluate(() =>
			window.forge.invoke('notifications:add', {
				module: 'runs',
				title: 'Run finished: e2e-run',
				level: 'success',
				target: { panelId: 'runs.monitor', params: { runId: 'e2e-run-0001' } },
			}),
		);
		await page.keyboard.press('Control+4');
		const inbox = page.locator('[data-inbox]');
		const row = inbox.locator('[data-notification]', { hasText: 'Run finished: e2e-run' });
		await expect(row).toHaveAttribute('data-read', 'false');
		await expect(page.locator('footer [data-unread="1"]')).toBeVisible();
		await row.click();
		await expect(page.locator('[data-room-layout="lab"]')).toBeVisible();
		await expect(page.locator('footer [data-unread="0"]')).toBeVisible();
		await page.keyboard.press('Control+4');
		await expect(row).toHaveAttribute('data-read', 'true');
		await inbox.getByRole('button', { name: 'Clear read' }).click();
		await expect(inbox.getByText('All caught up')).toBeVisible();
	} finally {
		await app.close();
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
		rmSync(vault, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
