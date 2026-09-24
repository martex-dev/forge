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
	'app:openExternal': { input: z.url({ protocol: /^https$/ }), output: z.void() },
});
