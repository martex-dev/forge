import type { Run } from '@shared/ipc/channels/lab';

import { flattenConfig } from './runs-model';

export const MAX_COMPARE = 8;

export type Direction = 'min' | 'max' | null;

const LOWER =
	/(loss|err|error|mae|mse|rmse|mape|perplexity|ppl|wer|cer|nll|brier|ece|time|latency)/i;
const HIGHER =
	/(acc|accuracy|f1|auc|precision|recall|map|iou|dice|bleu|rouge|score|r2|sharpe|reward)/i;

/** Which way is better, guessed from the name (e.g. val/loss → lower, val_acc → higher). */
export function metricDirection(key: string): Direction {
	const name = key.split('/').pop() ?? key;
	if (HIGHER.test(name)) return 'max';
	if (LOWER.test(name)) return 'min';
	return null;
}

/** Index of the best value; null when the direction is unknown, nothing to rank, or a tie. */
export function bestIndex(
	values: ReadonlyArray<number | null>,
	direction: Direction,
): number | null {
	if (!direction) return null;
	let best: number | null = null;
	values.forEach((v, i) => {
		if (v === null) return;
		const cur = best === null ? null : values[best];
		if (cur === null || cur === undefined || (direction === 'min' ? v < cur : v > cur))
			best = i;
	});
	const present = values.filter((v): v is number => v !== null);
	// A single run with a value isn't a comparison, and a tie for first has no winner.
	if (present.length < 2 || best === null) return null;
	const top = values[best];
	return present.filter((v) => v === top).length > 1 ? null : best;
}

export interface ConfigRow {
	key: string;
	/** One per run; undefined = the key is missing in that run. */
	values: Array<string | undefined>;
	differs: boolean;
}

export function configDiff(configs: ReadonlyArray<Record<string, unknown>>): ConfigRow[] {
	const flat = configs.map((c) => new Map(flattenConfig(c)));
	const keys = [...new Set(flat.flatMap((m) => [...m.keys()]))].sort((a, b) =>
		a.localeCompare(b),
	);
	return keys.map((key) => {
		const values = flat.map((m) => m.get(key));
		return { key, values, differs: new Set(values).size > 1 };
	});
}

/**
 * TensorBoard-style debiased EMA: early points aren't dragged toward 0, and NaN/missing values
 * pass through without poisoning the average. weight 0 = raw.
 */
export function smooth(
	points: ReadonlyArray<[number, number | null]>,
	weight: number,
): Array<[number, number | null]> {
	if (weight <= 0) return points.map(([s, v]) => [s, v]);
	let last = 0;
	let n = 0;
	return points.map(([step, v]) => {
		if (v === null || !Number.isFinite(v)) return [step, v];
		last = last * weight + (1 - weight) * v;
		n += 1;
		return [step, last / (1 - weight ** n)];
	});
}

/** Metric keys across runs, most shared first, so the charts that compare everything come first. */
export function sharedKeys(keysPerRun: ReadonlyArray<readonly string[]>): string[] {
	const counts = new Map<string, number>();
	for (const keys of keysPerRun) for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
	return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
}

/** The selected run plus the closest earlier run of the same project: the usual "did it help?". */
export function defaultComparison(runs: readonly Run[], selected: Run): string[] {
	const earlier = runs.filter((r) => r.id !== selected.id && r.startedAt <= selected.startedAt);
	const peer =
		earlier.find((r) => r.project !== null && r.project === selected.project) ??
		earlier[0] ??
		runs.find((r) => r.id !== selected.id);
	return peer ? [selected.id, peer.id] : [selected.id];
}
