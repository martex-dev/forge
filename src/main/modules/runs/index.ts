import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { app } from 'electron';
import type { z } from 'zod';

import { MetricsPageSchema, type Run, type RunStatus } from '@shared/ipc/channels/lab';
import { manifest } from '@shared/modules/runs.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule, MainModuleContext } from '../../core/modules/types';
import { SidecarRunDetailSchema, SidecarRunSchema, toRun, toRunDetail } from './map-run';
import { endedRuns, runNotification } from './run-watch';

// How often main checks for runs that ended, to notify even when the Lab room is closed.
const WATCH_MS = 5_000;

async function fetchParsed<S extends z.ZodType>(
	ctx: MainModuleContext,
	path: string,
	schema: S,
): Promise<z.output<S>> {
	const parsed = schema.safeParse(await ctx.sidecar('GET', path));
	if (!parsed.success) {
		ctx.log.error('unexpected runs payload', { path, issues: parsed.error.message });
		throw new ForgeError('RUNS_BAD_DATA', 'The run store returned unexpected data');
	}
	return parsed.data;
}

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const listRuns = async (): Promise<Run[]> =>
			(await fetchParsed(ctx, '/runs', SidecarRunSchema.array())).map(toRun);
		ctx.ipc.handle('runs:list', listRuns);

		let known: Map<string, RunStatus> | null = null;
		let lastError = '';
		const watch = setInterval(() => {
			listRuns()
				.then((runs) => {
					for (const run of endedRuns(known, runs)) ctx.notify(runNotification(run));
					known = new Map(runs.map((r) => [r.id, r.status]));
					lastError = '';
				})
				.catch((error: unknown) => {
					// The sidecar restarting is normal; log other failures once, not every 5 s.
					const code = error instanceof ForgeError ? error.code : String(error);
					if (code !== 'SIDECAR_UNAVAILABLE' && code !== lastError) {
						ctx.log.warn('run watch failed', { error: String(error) });
					}
					lastError = code;
				});
		}, WATCH_MS);
		ctx.onDispose(() => clearInterval(watch));
		ctx.ipc.handle('runs:get', async (id) =>
			toRunDetail(await fetchParsed(ctx, `/runs/${id}`, SidecarRunDetailSchema)),
		);
		ctx.ipc.handle('runs:metrics', ({ id, after }) =>
			fetchParsed(ctx, `/runs/${id}/metrics?after=${after}`, MetricsPageSchema),
		);
		ctx.ipc.handle('runs:delete', async (id) => {
			await ctx.sidecar('DELETE', `/runs/${id}`);
		});
		ctx.ipc.handle('runs:setup', () => {
			// Only meaningful when running from the repo (dev); a packaged app doesn't ship it.
			const packageDir = join(app.getAppPath(), 'packages', 'forge-probe');
			const example = join(app.getAppPath(), 'examples', 'train_mnist_probe.py');
			return {
				packageDir: existsSync(packageDir) ? packageDir : null,
				exampleScript: existsSync(example) ? example : null,
			};
		});
	},
};
