import { describe, expect, it } from 'vitest';

import type { Gpu, GpuSnapshot } from '@shared/ipc/channels/lab';

import { formatGiB, memoryPercent, pushSample, temperatureLevel } from './gpu-model';

const gpu = (overrides: Partial<Gpu> = {}): Gpu => ({
	index: 0,
	name: 'RTX 5070',
	utilization: 40,
	memoryUsed: 3 * 2 ** 30,
	memoryTotal: 12 * 2 ** 30,
	temperature: 60,
	power: 120,
	powerLimit: 250,
	fan: null,
	...overrides,
});
const snap = (gpus: Gpu[], available = true): GpuSnapshot => ({
	available,
	reason: null,
	driver: '610.74',
	gpus,
});

describe('pushSample', () => {
	it('appends per GPU and keeps only the newest samples', () => {
		let h = pushSample({}, snap([gpu(), gpu({ index: 1, utilization: 5 })]), 1);
		h = pushSample(h, snap([gpu({ utilization: 90 })]), 2, 2);
		h = pushSample(h, snap([gpu({ utilization: 95 })]), 3, 2);
		expect(h[0]?.map((s) => [s.t, s.utilization])).toEqual([
			[2, 90],
			[3, 95],
		]);
		expect(h[0]?.[0]?.memory).toBe(25);
		expect(h[1]?.map((s) => s.utilization)).toEqual([5]);
	});

	it('ignores snapshots without a GPU', () => {
		const h = {};
		expect(pushSample(h, snap([], false), 1)).toBe(h);
	});
});

describe('helpers', () => {
	it('computes memory percent defensively', () => {
		expect(memoryPercent(gpu())).toBe(25);
		expect(memoryPercent(gpu({ memoryTotal: 0 }))).toBeNull();
		expect(memoryPercent(gpu({ memoryUsed: null }))).toBeNull();
	});

	it('classifies temperatures', () => {
		expect(temperatureLevel(null)).toBe('ok');
		expect(temperatureLevel(79)).toBe('ok');
		expect(temperatureLevel(80)).toBe('warn');
		expect(temperatureLevel(87)).toBe('hot');
	});

	it('formats GiB', () => {
		expect(formatGiB(4_596_285_440)).toBe('4.3');
		expect(formatGiB(null)).toBe('—');
	});
});
