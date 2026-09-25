import type { ForgeNotification, NotificationLevel } from '@shared/notifications';

export const LEVELS: NotificationLevel[] = ['error', 'warn', 'success', 'info'];

export interface InboxFilters {
	levels: NotificationLevel[];
	/** null = all modules. */
	module: string | null;
	unreadOnly: boolean;
}

export const DEFAULT_FILTERS: InboxFilters = { levels: LEVELS, module: null, unreadOnly: false };

export function filterNotifications(
	list: readonly ForgeNotification[],
	filters: InboxFilters,
): ForgeNotification[] {
	return list.filter(
		(n) =>
			filters.levels.includes(n.level) &&
			(filters.module === null || n.module === filters.module) &&
			(!filters.unreadOnly || !n.read),
	);
}

export function modulesIn(list: readonly ForgeNotification[]): string[] {
	return [...new Set(list.map((n) => n.module))].sort();
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
