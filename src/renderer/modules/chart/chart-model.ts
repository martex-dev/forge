import {
	type Candle,
	type ChartSource,
	ChartSourceSchema,
	type Interval,
	IntervalSchema,
} from '@shared/ipc/channels/chart';

import type { PanelParams } from '../types';

export const DEFAULT_SOURCE: ChartSource = { kind: 'binance', symbol: 'BTCUSDT' };
export const DEFAULT_INTERVAL: Interval = '1h';
export const QUICK_SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'] as const;
/** Bars shown when a series first loads; the rest is a scroll away. */
export const INITIAL_VISIBLE_BARS = 150;
// More new bars than this in one poll means we missed a lot (sleep, offline): redraw instead.
const MAX_TAIL = 5;

export interface ChartParams {
	source: ChartSource;
	interval: Interval;
	/** e.g. "BONK/SOL" for pools; addresses aren't readable. */
	label: string | null;
}

/** Panel params come back from a saved layout, so they're untrusted: fall back per field. */
export function readParams(params: PanelParams): ChartParams {
	const source = ChartSourceSchema.safeParse(params['source']);
	const interval = IntervalSchema.safeParse(params['interval']);
	const label = params['label'];
	return {
		source: source.success ? source.data : DEFAULT_SOURCE,
		interval: interval.success ? interval.data : DEFAULT_INTERVAL,
		label: typeof label === 'string' && label.length <= 60 ? label : null,
	};
}

export function sourceKey(source: ChartSource): string {
	return source.kind === 'binance'
		? `binance:${source.symbol}`
		: `pool:${source.chainId}:${source.pairAddress.toLowerCase()}`;
}

export function sourceLabel(source: ChartSource, label: string | null): string {
	if (source.kind === 'binance') return source.symbol;
	return label ?? `${source.pairAddress.slice(0, 6)}…`;
}

/**
 * The bars to apply with series.update() when a poll only moved the tail (last bar changed,
 * maybe a new one opened). null means redraw everything with setData().
 */
export function tailUpdates(prev: readonly Candle[], next: readonly Candle[]): Candle[] | null {
	const last = prev.at(-1);
	if (!last) return null;
	for (let i = next.length - 1; i >= 0 && next.length - i <= MAX_TAIL; i--) {
		if (next[i]?.time === last.time) return next.slice(i);
	}
	return null;
}

/** Enough decimals to show ~4 significant digits: 84417.05 → 2, 0.55 → 4, 0.0000213 → 8. */
export function pricePrecision(price: number): number {
	if (!Number.isFinite(price) || price <= 0) return 2;
	return Math.min(12, Math.max(2, -Math.floor(Math.log10(price)) + 3));
}

export interface SeriesSummary {
	last: number;
	/** % change from the first loaded bar's open to the latest close. */
	change: number | null;
	high: number;
	low: number;
}

export function summarize(candles: readonly Candle[]): SeriesSummary | null {
	const first = candles[0];
	const last = candles.at(-1);
	if (!first || !last) return null;
	let high = -Infinity;
	let low = Infinity;
	for (const c of candles) {
		high = Math.max(high, c.high);
		low = Math.min(low, c.low);
	}
	return {
		last: last.close,
		change: first.open > 0 ? ((last.close - first.open) / first.open) * 100 : null,
		high,
		low,
	};
}

const pad = (n: number): string => String(n).padStart(2, '0');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Time-axis labels in local time (lightweight-charts formats UTC by default). */
export function formatTick(seconds: number, kind: 'year' | 'month' | 'day' | 'time'): string {
	const d = new Date(seconds * 1000);
	switch (kind) {
		case 'year':
			return String(d.getFullYear());
		case 'month':
			return MONTHS[d.getMonth()] ?? '';
		case 'day':
			return `${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`;
		case 'time':
			return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
	}
}

/** Crosshair label, e.g. "Thu 25 Sep 14:00". */
export function formatCrosshairTime(seconds: number): string {
	const d = new Date(seconds * 1000);
	const day = d.toLocaleDateString('en-GB', { weekday: 'short' });
	return `${day} ${formatTick(seconds, 'day')} ${formatTick(seconds, 'time')}`;
}
