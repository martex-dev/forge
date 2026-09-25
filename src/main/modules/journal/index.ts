import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { app, BrowserWindow, dialog, type OpenDialogOptions } from 'electron';

import { manifest } from '@shared/modules/journal.manifest';

import type { MainModule } from '../../core/modules/types';
import { JournalStore, mimeOfPath } from './journal-store';

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const store = new JournalStore(join(app.getPath('userData'), 'journal'));
		ctx.onDispose(() => store.close());

		ctx.ipc.handle('journal:list', () => store.list());
		ctx.ipc.handle('journal:save', (entry) => store.save(entry));
		ctx.ipc.handle('journal:delete', (id) => store.delete(id));
		ctx.ipc.handle('journal:addImage', ({ entryId, mime, base64 }) =>
			store.addImage(entryId, mime, Buffer.from(base64, 'base64')),
		);
		ctx.ipc.handle('journal:image', ({ entryId, file }) => store.imageDataUrl(entryId, file));
		ctx.ipc.handle('journal:removeImage', ({ entryId, file }) =>
			store.removeImage(entryId, file),
		);
		ctx.ipc.handle('journal:pickImages', async (entryId) => {
			const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
			const options: OpenDialogOptions = {
				title: 'Add screenshots',
				properties: ['openFile', 'multiSelections'],
				filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
			};
			const result = win
				? await dialog.showOpenDialog(win, options)
				: await dialog.showOpenDialog(options);
			let entry = store.get(entryId);
			for (const path of result.canceled ? [] : result.filePaths) {
				const mime = mimeOfPath(path);
				if (mime) entry = store.addImage(entryId, mime, readFileSync(path));
			}
			return entry;
		});
	},
};
