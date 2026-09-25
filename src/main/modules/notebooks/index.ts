import { readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { BrowserWindow, dialog, type OpenDialogOptions, type SaveDialogOptions } from 'electron';
import { z } from 'zod';

import { ExecStateSchema, NbOutputSchema } from '@shared/ipc/channels/notebooks';
import { manifest } from '@shared/modules/notebooks.manifest';

import type { MainModule } from '../../core/modules/types';
import { emptyNotebook, parseNotebook, serializeNotebook } from './notebook-io';

const RecentSchema = z.array(z.string()).max(12);
const SidecarPoll = z.object({
	status: ExecStateSchema.shape.status,
	execution_count: z.number().int().nullable(),
	outputs: z.array(NbOutputSchema),
	next: z.number().int(),
	kernel_state: ExecStateSchema.shape.kernelState,
});
const SidecarSpecs = z.array(
	z.object({ name: z.string(), display_name: z.string(), language: z.string() }),
);

function window(): BrowserWindow | undefined {
	return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
}

async function openDialog(options: OpenDialogOptions): Promise<string | null> {
	const win = window();
	const result = win
		? await dialog.showOpenDialog(win, options)
		: await dialog.showOpenDialog(options);
	return result.canceled ? null : (result.filePaths[0] ?? null);
}

/** Write-then-rename, so a crash mid-save never leaves half a notebook. */
async function writeAtomic(path: string, text: string): Promise<void> {
	const tmp = `${path}.forge-tmp`;
	await writeFile(tmp, text, 'utf8');
	await rename(tmp, path);
}

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const remember = (path: string): void => {
			const recent = ctx.settings.get('recent', RecentSchema, []);
			ctx.settings.set(
				'recent',
				RecentSchema,
				[path, ...recent.filter((p) => p !== path)].slice(0, 12),
			);
		};

		ctx.ipc.handle('nb:pick', () =>
			openDialog({
				title: 'Open notebook',
				properties: ['openFile'],
				filters: [{ name: 'Jupyter notebooks', extensions: ['ipynb'] }],
			}),
		);
		ctx.ipc.handle('nb:create', async () => {
			const options: SaveDialogOptions = {
				title: 'New notebook',
				defaultPath: 'Untitled.ipynb',
				filters: [{ name: 'Jupyter notebooks', extensions: ['ipynb'] }],
			};
			const win = window();
			const result = win
				? await dialog.showSaveDialog(win, options)
				: await dialog.showSaveDialog(options);
			if (result.canceled || !result.filePath) return null;
			await writeAtomic(result.filePath, serializeNotebook(emptyNotebook()));
			return result.filePath;
		});
		ctx.ipc.handle('nb:recent', () => ctx.settings.get('recent', RecentSchema, []));
		ctx.ipc.handle('nb:read', async (path) => {
			const notebook = parseNotebook(await readFile(path, 'utf8'));
			remember(path);
			return notebook;
		});
		ctx.ipc.handle('nb:write', ({ path, notebook }) =>
			writeAtomic(path, serializeNotebook(notebook)),
		);

		ctx.ipc.handle('nb:kernelspecs', async () =>
			SidecarSpecs.parse(await ctx.sidecar('GET', '/nb/kernelspecs')).map((s) => ({
				name: s.name,
				displayName: s.display_name,
				language: s.language,
			})),
		);
		ctx.ipc.handle('nb:pickPython', () =>
			openDialog({
				title: 'Python interpreter (needs ipykernel)',
				properties: ['openFile'],
				filters: [{ name: 'Python', extensions: ['exe', ''] }],
			}),
		);
		ctx.ipc.handle('nb:start', async ({ path, kernel }) => {
			// Kernels run with the notebook's folder as cwd, as Jupyter does (relative data paths work).
			const body = {
				...('spec' in kernel ? { spec: kernel.spec } : { python: kernel.python }),
				cwd: dirname(path),
			};
			const res = z
				.object({ id: z.string(), label: z.string() })
				.parse(await ctx.sidecar('POST', '/nb/sessions', body));
			return { session: res.id, label: res.label };
		});
		ctx.ipc.handle(
			'nb:execute',
			async ({ session, code }) =>
				z
					.object({ id: z.string() })
					.parse(await ctx.sidecar('POST', `/nb/sessions/${session}/execute`, { code }))
					.id,
		);
		ctx.ipc.handle('nb:poll', async ({ session, exec, after }) => {
			const r = SidecarPoll.parse(
				await ctx.sidecar(
					'GET',
					`/nb/sessions/${session}/executions/${encodeURIComponent(exec)}?after=${after}`,
				),
			);
			return {
				status: r.status,
				executionCount: r.execution_count,
				outputs: r.outputs,
				next: r.next,
				kernelState: r.kernel_state,
			};
		});
		ctx.ipc.handle('nb:interrupt', async (session) => {
			await ctx.sidecar('POST', `/nb/sessions/${session}/interrupt`);
		});
		ctx.ipc.handle('nb:restart', async (session) => {
			await ctx.sidecar('POST', `/nb/sessions/${session}/restart`);
		});
		ctx.ipc.handle('nb:shutdown', async (session) => {
			await ctx.sidecar('DELETE', `/nb/sessions/${session}`);
		});
	},
};
