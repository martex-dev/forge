import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { app } from 'electron';
import type { z } from 'zod';

import { MetricsPageSchema } from '@shared/ipc/channels/lab';
import { manifest } from '@shared/modules/runs.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule, MainModuleContext } from '../../core/modules/types';
import { SidecarRunDetailSchema, SidecarRunSchema, toRun, toRunDetail } from './map-run';

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
		ctx.ipc.handle('runs:list', async () =>
			(await fetchParsed(ctx, '/runs', SidecarRunSchema.array())).map(toRun),
		);
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
