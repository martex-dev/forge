import { z } from 'zod';

import { manifest } from '@shared/modules/gpu.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';

const SidecarGpuSnapshotSchema = z.object({
	available: z.boolean(),
	reason: z.string().nullable(),
	driver: z.string().nullable(),
	gpus: z.array(
		z.object({
			index: z.number().int(),
			name: z.string(),
			utilization: z.number().nullable(),
			memory_used: z.number().nullable(),
			memory_total: z.number().nullable(),
			temperature: z.number().nullable(),
			power: z.number().nullable(),
			power_limit: z.number().nullable(),
			fan: z.number().nullable(),
		}),
	),
});

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		ctx.ipc.handle('gpu:snapshot', async () => {
			const parsed = SidecarGpuSnapshotSchema.safeParse(await ctx.sidecar('GET', '/gpu'));
			if (!parsed.success) {
				ctx.log.error('unexpected GPU payload', { issues: parsed.error.message });
				throw new ForgeError('GPU_BAD_DATA', 'The GPU service returned unexpected data');
			}
			const s = parsed.data;
			return {
				available: s.available,
				reason: s.reason,
				driver: s.driver,
				gpus: s.gpus.map((g) => ({
					index: g.index,
					name: g.name,
					utilization: g.utilization,
					memoryUsed: g.memory_used,
					memoryTotal: g.memory_total,
					temperature: g.temperature,
					power: g.power,
					powerLimit: g.power_limit,
					fan: g.fan,
				})),
			};
		});
	},
};
