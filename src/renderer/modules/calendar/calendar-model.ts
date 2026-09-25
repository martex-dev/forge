import type { CalendarEvent, Impact } from '@shared/ipc/channels/calendar';

export const IMMINENT_MS = 30 * 60 * 1000;

export interface CalendarFilters {
	impacts: Impact[];
	/** Empty = all currencies. */
	currencies: string[];
}

export const DEFAULT_FILTERS: CalendarFilters = { impacts: ['high', 'medium'], currencies: [] };

export function applyFilters(
	events: readonly CalendarEvent[],
	f: CalendarFilters,
): CalendarEvent[] {
	return events.filter(
		(e) =>
			f.impacts.includes(e.impact) &&
			(f.currencies.length === 0 || f.currencies.includes(e.currency)),
	);
}

export function currenciesIn(events: readonly CalendarEvent[]): string[] {
	return [...new Set(events.map((e) => e.currency))].sort();
}

export interface DayGroup {
	key: string;
	label: string;
	events: CalendarEvent[];
}

/** Groups by local calendar day (the user's timezone), in time order. */
export function groupByDay(events: readonly CalendarEvent[], locale?: string): DayGroup[] {
	const groups = new Map<string, DayGroup>();
	for (const e of [...events].sort((a, b) => a.time - b.time)) {
		const d = new Date(e.time);
		const key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
		let group = groups.get(key);
		if (!group) {
			group = {
				key,
				label: d.toLocaleDateString(locale, {
					weekday: 'long',
					day: 'numeric',
					month: 'short',
				}),
				events: [],
			};
			groups.set(key, group);
		}
		group.events.push(e);
	}
	return [...groups.values()];
}

export function nextEvent(
	events: readonly CalendarEvent[],
	now: number,
	impact: Impact = 'high',
): CalendarEvent | null {
	return (
		[...events]
			.filter((e) => e.impact === impact && e.time > now)
			.sort((a, b) => a.time - b.time)[0] ?? null
	);
}

export function isImminent(e: CalendarEvent, now: number): boolean {
	return e.time > now && e.time - now <= IMMINENT_MS;
}

/** "2d 4h", "3h 05m", "12m 09s", "45s". */
export function formatCountdown(ms: number): string {
	const s = Math.max(0, Math.floor(ms / 1000));
	const d = Math.floor(s / 86_400);
	const h = Math.floor((s % 86_400) / 3600);
	const m = Math.floor((s % 3600) / 60);
	const sec = s % 60;
	const pad = (n: number): string => String(n).padStart(2, '0');
	if (d > 0) return `${d}d ${h}h`;
	if (h > 0) return `${h}h ${pad(m)}m`;
	if (m > 0) return `${m}m ${pad(sec)}s`;
	return `${sec}s`;
}
