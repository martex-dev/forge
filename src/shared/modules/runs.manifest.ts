import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'runs',
	name: 'Run Monitor',
	description:
		'Live metrics from training scripts that use forge-probe: run list, charts, config.',
	room: 'lab',
	defaultEnabled: true,
});
