import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { z } from 'zod';

import {
	FRAME_EXTENSIONS,
	FrameHistogramSchema,
	FramePageSchema,
} from '@shared/ipc/channels/frames';
import { manifest } from '@shared/modules/frames.manifest';

import type { MainModule } from '../../core/modules/types';
import { FrameClient } from './frame-client';

const RecentSchema = z.array(z.string()).max(12);

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const client = new FrameClient((method, path, body) => ctx.sidecar(method, path, body));
		const remember = (path: string): void => {
			const recent = ctx.settings.get('recent', RecentSchema, []);
			ctx.settings.set(
				'recent',
				RecentSchema,
				[path, ...recent.filter((p) => p !== path)].slice(0, 12),
			);
		};

		ctx.ipc.handle('frames:pick', async () => {
			const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
			const options: OpenDialogOptions = {
				title: 'Open data file',
				properties: ['openFile'],
				filters: [{ name: 'Data files', extensions: [...FRAME_EXTENSIONS] }],
			};
			const result = win
				? await dialog.showOpenDialog(win, options)
				: await dialog.showOpenDialog(options);
			return result.canceled ? null : (result.filePaths[0] ?? null);
		});
		ctx.ipc.handle('frames:recent', () => ctx.settings.get('recent', RecentSchema, []));
		ctx.ipc.handle('frames:open', async (path) => {
			const info = await client.open(path);
			remember(path);
			return info;
		});
		ctx.ipc.handle('frames:rows', async ({ path, ...query }) =>
			FramePageSchema.parse(
				await client.call(path, (id) => ctx.sidecar('POST', `/frames/${id}/rows`, query)),
			),
		);
		ctx.ipc.handle('frames:summary', (path) => client.summary(path));
		ctx.ipc.handle('frames:histogram', async ({ path, column, bins }) =>
			FrameHistogramSchema.parse(
				await client.call(path, (id) =>
					ctx.sidecar('POST', `/frames/${id}/histogram`, { column, bins }),
				),
			),
		);
		ctx.ipc.handle('frames:close', (path) => client.close(path));
	},
};
