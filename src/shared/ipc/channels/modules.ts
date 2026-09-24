import { z } from 'zod';

import { ModuleInfoSchema } from '../../modules/types';
import { defineChannels } from '../define';

export const moduleChannels = defineChannels({
	'modules:list': { input: z.void(), output: z.array(ModuleInfoSchema) },
	'modules:setEnabled': {
		input: z.object({ id: z.string(), enabled: z.boolean() }),
		output: z.array(ModuleInfoSchema),
	},
});

export const moduleEvents = {
	'modules:changed': z.array(ModuleInfoSchema),
};
