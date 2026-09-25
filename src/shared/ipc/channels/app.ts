import { z } from 'zod';

import { defineChannels } from '../define';

export const appChannels = defineChannels({
	'app:getVersion': { input: z.void(), output: z.string() },
	'app:getPlatform': {
		input: z.void(),
		output: z.enum([
			'aix',
			'darwin',
			'freebsd',
			'linux',
			'openbsd',
			'sunos',
			'win32',
			'android',
			'haiku',
			'cygwin',
			'netbsd',
		]),
	},
	'app:reloadWindow': { input: z.void(), output: z.void() },
	/** Whether to show the first-launch guide (never in test runs). */
	'app:onboarding': { input: z.void(), output: z.object({ show: z.boolean() }) },
	'app:onboardingDone': { input: z.void(), output: z.void() },
	'app:openExternal': { input: z.url({ protocol: /^https$/ }), output: z.void() },
	/** Renderer has no file logger; it forwards warnings/errors to main's electron-log. */
	'app:log': {
		input: z.object({
			level: z.enum(['info', 'warn', 'error']),
			scope: z.string().max(64),
			message: z.string().max(4000),
			detail: z.string().max(20_000).optional(),
		}),
		output: z.void(),
	},
});
