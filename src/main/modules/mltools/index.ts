import { BrowserWindow, dialog, type OpenDialogOptions } from 'electron';
import { z } from 'zod';

import { CalibrationSchema, CvFoldsSchema } from '@shared/ipc/channels/lab';
import { manifest } from '@shared/modules/mltools.manifest';

import type { MainModule } from '../../core/modules/types';

async function openDialog(options: OpenDialogOptions): Promise<string | null> {
	const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
	const result = win
		? await dialog.showOpenDialog(win, options)
		: await dialog.showOpenDialog(options);
	return result.canceled ? null : (result.filePaths[0] ?? null);
}

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		ctx.ipc.handle('ml:cv', async ({ params, engine }) =>
			CvFoldsSchema.parse(await ctx.sidecar('POST', '/mltools/cv', { ...params, engine })),
		);
		ctx.ipc.handle('ml:calibration', async ({ params, engine }) =>
			CalibrationSchema.extend({ dropped_rows: z.number().int() }).parse(
				await ctx.sidecar('POST', '/mltools/calibration', { ...params, engine }),
			),
		);
		ctx.ipc.handle('ml:pickFile', () =>
			openDialog({
				title: 'Predictions file (labels + probabilities)',
				properties: ['openFile'],
				filters: [
					{ name: 'CSV or Parquet', extensions: ['csv', 'tsv', 'txt', 'parquet', 'pq'] },
				],
			}),
		);
		ctx.ipc.handle('ml:columns', async (path) =>
			z.array(z.string()).parse(await ctx.sidecar('POST', '/mltools/columns', { path })),
		);
		ctx.ipc.handle('ml:kernelspecs', async () =>
			z
				.array(z.object({ name: z.string(), display_name: z.string() }))
				.parse(await ctx.sidecar('GET', '/nb/kernelspecs'))
				.map((s) => ({ name: s.name, displayName: s.display_name })),
		);
		ctx.ipc.handle('ml:pickPython', () =>
			openDialog({
				title: 'Python interpreter (needs ipykernel, scikit-learn, purged-cv, calibrate)',
				properties: ['openFile'],
				filters: [{ name: 'Python', extensions: ['exe', ''] }],
			}),
		);
	},
};
