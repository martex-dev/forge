import type { CalendarAlert, PriceAlert } from '@shared/ipc/channels/alerts';

/**
 * Crossing semantics (like TradingView's "crossing up/down"): an alert fires when the price moves
 * from one side of the value to the other between two checks. An alert created while the price
 * is already past the value waits for the next cross, instead of firing instantly.
 */
export function crossed(alert: PriceAlert, previous: number | null, current: number): boolean {
	if (previous === null) return false;
	return alert.op === 'above'
		? previous < alert.value && current >= alert.value
		: previous > alert.value && current <= alert.value;
}

export interface CalendarEventLike {
	id: string;
	title: string;
	currency: string;
	impact: string;
	/** Epoch ms. */
	time: number;
	forecast: string | null;
	previous: string | null;
}

/** Events that entered the rule's warning window and haven't been announced for it yet. */
export function dueEvents(
	alert: CalendarAlert,
	events: readonly CalendarEventLike[],
	now: number,
	fired: ReadonlySet<string>,
): CalendarEventLike[] {
	const window = alert.minutesBefore * 60_000;
	const currencies = new Set(alert.currencies.map((c) => c.toUpperCase()));
	return events.filter(
		(e) =>
			(alert.impacts as string[]).includes(e.impact) &&
			(currencies.size === 0 || currencies.has(e.currency.toUpperCase())) &&
			e.time > now &&
			e.time - now <= window &&
			!fired.has(firedKey(alert.id, e.id)),
	);
}

export const firedKey = (alertId: string, eventId: string): string => `${alertId}:${eventId}`;

export function describeSource(alert: PriceAlert): string {
	return alert.source.kind === 'binance' ? alert.source.symbol : alert.source.label;
}

export function formatValue(value: number): string {
	if (value >= 1000) return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
	if (value >= 1) return value.toFixed(4).replace(/\.?0+$/, '');
	return value.toPrecision(4);
}
