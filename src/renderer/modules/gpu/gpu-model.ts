import type { Gpu, GpuSnapshot } from '@shared/ipc/channels/lab';

export const HISTORY_SAMPLES = 90; // 3 min at the 2 s poll

export interface GpuSample {
	t: number;
	utilization: number | null;
	/** VRAM used, % of total. */
	memory: number | null;
	temperature: number | null;
	power: number | null;
}

export type GpuHistory = Readonly<Record<number, readonly GpuSample[]>>;

export function memoryPercent(gpu: Gpu): number | null {
	if (gpu.memoryUsed === null || !gpu.memoryTotal) return null;
	return (gpu.memoryUsed / gpu.memoryTotal) * 100;
}

export function pushSample(
	history: GpuHistory,
	snapshot: GpuSnapshot,
	t: number,
	max = HISTORY_SAMPLES,
): GpuHistory {
	if (!snapshot.available) return history;
	const next: Record<number, readonly GpuSample[]> = { ...history };
	for (const gpu of snapshot.gpus) {
		const sample: GpuSample = {
			t,
			utilization: gpu.utilization,
			memory: memoryPercent(gpu),
			temperature: gpu.temperature,
			power: gpu.power,
		};
		next[gpu.index] = [...(history[gpu.index] ?? []), sample].slice(-max);
	}
	return next;
}

export type Level = 'ok' | 'warn' | 'hot';

/** Most GeForce cards throttle in the high 80s °C. */
export function temperatureLevel(celsius: number | null): Level {
	if (celsius === null || celsius < 80) return 'ok';
	return celsius < 87 ? 'warn' : 'hot';
}

export function formatGiB(bytes: number | null): string {
	return bytes === null ? '—' : (bytes / 2 ** 30).toFixed(1);
}
