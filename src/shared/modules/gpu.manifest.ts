import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'gpu',
	name: 'GPU Monitor',
	description: 'NVIDIA GPU utilization, VRAM, temperature and power (via NVML).',
	room: 'lab',
	defaultEnabled: true,
});
