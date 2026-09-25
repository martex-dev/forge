import type { ForgeNotification, NotificationLevel } from '@shared/notifications';

export const LEVELS: NotificationLevel[] = ['error', 'warn', 'success', 'info'];

export interface InboxFilters {
	levels: NotificationLevel[];
	/** null = all modules. */
	module: string | null;
	unreadOnly: boolean;
	/** Matches title, body and module id. */
	query: string;
}

export const DEFAULT_FILTERS: InboxFilters = {
	levels: LEVELS,
	module: null,
	unreadOnly: false,
	query: '',
};

export function filterNotifications(
	list: readonly ForgeNotification[],
	filters: InboxFilters,
): ForgeNotification[] {
	const q = filters.query.trim().toLowerCase();
	return list.filter(
		(n) =>
			filters.levels.includes(n.level) &&
			(filters.module === null || n.module === filters.module) &&
			(!filters.unreadOnly || !n.read) &&
			(q === '' ||
				n.title.toLowerCase().includes(q) ||
				n.body.toLowerCase().includes(q) ||
				n.module.includes(q)),
	);
}

export function modulesIn(list: readonly ForgeNotification[]): string[] {
	return [...new Set(list.map((n) => n.module))].sort();
}

export interface SourceCount {
	module: string;
	total: number;
	unread: number;
}

/** Per source, busiest first: the chips across the top of the inbox. */
export function countBySource(list: readonly ForgeNotification[]): SourceCount[] {
	const counts = new Map<string, SourceCount>();
	for (const n of list) {
		const c = counts.get(n.module) ?? { module: n.module, total: 0, unread: 0 };
		c.total += 1;
		if (!n.read) c.unread += 1;
		counts.set(n.module, c);
	}
	return [...counts.values()].sort(
		(a, b) => b.unread - a.unread || b.total - a.total || a.module.localeCompare(b.module),
	);
}

export interface Collapsed {
	/** The newest of the run; its id opens and represents it. */
	n: ForgeNotification;
	ids: string[];
	unread: boolean;
}

/**
 * Consecutive notifications with the same source and title (a price alert firing every cross, a
 * flapping deploy) become one row with a count, so they don't bury everything else.
 */
export function collapseRepeats(items: readonly ForgeNotification[]): Collapsed[] {
	const out: Collapsed[] = [];
	for (const n of items) {
		const last = out.at(-1);
		if (last && last.n.module === n.module && last.n.title === n.title) {
			last.ids.push(n.id);
			last.unread ||= !n.read;
		} else {
			out.push({ n, ids: [n.id], unread: !n.read });
		}
	}
	return out;
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const startOfDay = (t: number): number => new Date(t).setHours(0, 0, 0, 0);

export function dayLabel(t: number, now: number): string {
	const days = Math.round((startOfDay(now) - startOfDay(t)) / 86_400_000);
	if (days === 0) return 'Today';
	if (days === 1) return 'Yesterday';
	const d = new Date(t);
	return `${WEEKDAYS[d.getDay()] ?? ''} ${d.getDate()} ${MONTHS[d.getMonth()] ?? ''}`;
}

export interface DayGroup {
	label: string;
	items: ForgeNotification[];
}

/** Newest first, split by local calendar day. */
export function groupByDay(list: readonly ForgeNotification[], now: number): DayGroup[] {
	const groups: DayGroup[] = [];
	for (const n of [...list].sort((a, b) => b.createdAt - a.createdAt)) {
		const label = dayLabel(n.createdAt, now);
		const last = groups.at(-1);
		if (last?.label === label) last.items.push(n);
		else groups.push({ label, items: [n] });
	}
	return groups;
}
