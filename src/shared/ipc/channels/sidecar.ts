import { z } from 'zod';

import { defineChannels } from '../define';

export const SidecarStateSchema = z.enum([
	'disabled',
	'starting',
	'ready',
	'restarting',
	'error',
	'stopped',
]);
export type SidecarState = z.infer<typeof SidecarStateSchema>;

export const SidecarStatusSchema = z.object({
	state: SidecarStateSchema,
	/** Restart attempt number while restarting (1-based). */
	attempt: z.number().int().nonnegative(),
	message: z.string().optional(),
	version: z.string().optional(),
	python: z.string().optional(),
});
export type SidecarStatus = z.infer<typeof SidecarStatusSchema>;

export const sidecarChannels = defineChannels({
	'sidecar:getStatus': { input: z.void(), output: SidecarStatusSchema },
	'sidecar:restart': { input: z.void(), output: SidecarStatusSchema },
});

export const sidecarEvents = {
	'sidecar:status': SidecarStatusSchema,
};
