import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'mltools',
	name: 'CV & Calibration',
	description:
		'cv-visualizer and calibrate as tools: a purged-CV splitter playground and calibration reports from a predictions file, run with Forge’s bundled libraries or in one of your environments.',
	room: 'lab',
	defaultEnabled: true,
});
