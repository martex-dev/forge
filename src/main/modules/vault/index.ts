import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { z } from 'zod';

import { manifest } from '@shared/modules/vault.manifest';

import type { MainModule } from '../../core/modules/types';
import { VaultService } from './vault-service';

const RootSchema = z.string().nullable();

export const mainModule: MainModule = {
	manifest,
	async activate(ctx) {
		const vault = new VaultService({
			changed: (paths, full) => ctx.emit('vault:changed', { paths, full }),
			error: (message, error) => ctx.log.warn(message, { error: String(error) }),
		});
		ctx.onDispose(() => vault.close());

		const open = async (root: string | null): Promise<ReturnType<VaultService['info']>> => {
			const info = await vault.open(root);
			ctx.settings.set('root', RootSchema, info.root);
			return info;
		};

		const saved = ctx.settings.get('root', RootSchema, null);
		if (saved) {
			// A moved/deleted vault shouldn't stop the module; the panel offers to pick again.
			await vault.open(saved).catch((error: unknown) => {
				ctx.log.warn('could not reopen vault', { root: saved, error: String(error) });
			});
		}

		ctx.ipc.handle('vault:info', () => vault.info());
		ctx.ipc.handle('vault:openDialog', async () => {
			const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
			const options: OpenDialogOptions = {
				title: 'Choose your Obsidian vault',
				properties: ['openDirectory'],
				...(vault.root ? { defaultPath: vault.root } : {}),
			};
			const result = win
				? await dialog.showOpenDialog(win, options)
				: await dialog.showOpenDialog(options);
			const picked = result.filePaths[0];
			if (result.canceled || !picked) return vault.info();
			return open(picked);
		});
		ctx.ipc.handle('vault:open', (root) => open(root));
		ctx.ipc.handle('vault:close', () => open(null));
		ctx.ipc.handle('vault:notes', () => vault.requireIndex().list());
		ctx.ipc.handle('vault:read', (path) => vault.read(path));
		ctx.ipc.handle('vault:write', async ({ path, content, baseMtime }) => ({
			mtime: await vault.write(path, content, baseMtime),
		}));
		ctx.ipc.handle('vault:create', ({ folder, name }) => vault.create(folder, name));
		ctx.ipc.handle('vault:resolve', ({ target, from }) =>
			vault.requireIndex().resolve(target, from),
		);
		ctx.ipc.handle('vault:tags', () => vault.requireIndex().tags());
		ctx.ipc.handle('vault:backlinks', (path) => vault.requireIndex().backlinks(path));
		ctx.ipc.handle('vault:search', (q) => vault.requireIndex().search(q));
		ctx.ipc.handle('vault:quickNote', (text) => vault.quickNote(text));
	},
};
