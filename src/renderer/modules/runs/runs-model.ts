import type { MetricPoint } from '@shared/ipc/channels/lab';

/** key → step → value (null = NaN/inf). Maps make re-logged steps a cheap overwrite. */
export type SeriesState = ReadonlyMap<string, ReadonlyMap<number, number | null>>;
export type Series = Record<string, Array<[number, number | null]>>;

export function mergePoints(state: SeriesState, points: readonly MetricPoint[]): SeriesState {
	if (points.length === 0) return state;
	const next = new Map(state);
	const touched = new Map<string, Map<number, number | null>>();
	for (const p of points) {
		let steps = touched.get(p.key);
		if (!steps) {
			steps = new Map(next.get(p.key));
			touched.set(p.key, steps);
			next.set(p.key, steps);
		}
		steps.set(p.step, p.value);
	}
	return next;
}

export function toSeries(state: SeriesState): Series {
	const out: Series = {};
	for (const [key, steps] of state) {
		out[key] = [...steps].sort((a, b) => a[0] - b[0]);
	}
	return out;
}

export interface ChartGroup {
	title: string;
	keys: string[];
}

/**
 * One chart per metric, except that `train/loss` and `val/loss` share a "loss" chart: comparing
 * them is the point. Order follows first appearance.
 */
export function chartGroups(keys: readonly string[]): ChartGroup[] {
	const groups = new Map<string, string[]>();
	for (const key of keys) {
		const slash = key.lastIndexOf('/');
		const title = slash > 0 && slash < key.length - 1 ? key.slice(slash + 1) : key;
		groups.set(title, [...(groups.get(title) ?? []), key]);
	}
	return [...groups].map(([title, members]) => ({ title, keys: members }));
}

/** {model: {layers: 2}} → [['model.layers', '2']] for the config table. */
export function flattenConfig(
	config: Record<string, unknown>,
	prefix = '',
): Array<[string, string]> {
	const rows: Array<[string, string]> = [];
	for (const [key, value] of Object.entries(config)) {
		const path = prefix ? `${prefix}.${key}` : key;
		if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
			rows.push(...flattenConfig(value as Record<string, unknown>, path));
		} else {
			rows.push([path, typeof value === 'string' ? value : JSON.stringify(value)]);
		}
	}
	return rows;
}

/** "45s", "12m 03s", "2h 05m", "3d 4h" */
export function formatDuration(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	const pad = (n: number): string => String(n).padStart(2, '0');
	if (s < 60) return `${s}s`;
	if (s < 3600) return `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
	if (s < 86_400) return `${Math.floor(s / 3600)}h ${pad(Math.floor((s % 3600) / 60))}m`;
	return `${Math.floor(s / 86_400)}d ${Math.floor((s % 86_400) / 3600)}h`;
}

/** Compact metric readout: 0.000123 → "1.230e-4", 2.5 → "2.5000", 12345.6 → "12,346". */
// Lives in lib/format so the shared ML views can use it too.
export { formatMetric } from '../../lib/format';

export function lastValue(
	points: ReadonlyArray<[number, number | null]> | undefined,
): number | null {
	return points?.at(-1)?.[1] ?? null;
}
