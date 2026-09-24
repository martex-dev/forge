import { z } from 'zod';

import { defineChannels } from '../define';

const InstanceId = z.string().min(1).max(128);

export const BoundsSchema = z.object({
	x: z.number().int().min(0),
	y: z.number().int().min(0),
	width: z.number().int().min(0).max(16_384),
	height: z.number().int().min(0).max(16_384),
});
export type Bounds = z.infer<typeof BoundsSchema>;

export const WebviewStateSchema = z.object({
	instanceId: z.string(),
	url: z.string(),
	title: z.string(),
	loading: z.boolean(),
	canGoBack: z.boolean(),
	/** Set when the last main-frame load failed. */
	error: z.string().nullable(),
});
export type WebviewState = z.infer<typeof WebviewStateSchema>;

export const webviewChannels = defineChannels({
	'webview:attach': {
		input: z.object({ instanceId: InstanceId, serviceId: z.string() }),
		output: WebviewStateSchema,
	},
	'webview:detach': { input: InstanceId, output: z.void() },
	/** The renderer owns visibility: panel shown, room active and no overlay open. */
	'webview:setBounds': {
		input: z.object({ instanceId: InstanceId, bounds: BoundsSchema, visible: z.boolean() }),
		output: z.void(),
	},
	'webview:navigate': {
		input: z.object({
			instanceId: InstanceId,
			action: z.enum(['back', 'forward', 'reload', 'home', 'openExternal']),
		}),
		output: z.void(),
	},
});

export const webviewEvents = {
	'webview:state': WebviewStateSchema,
};
