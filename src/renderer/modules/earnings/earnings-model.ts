import type { EarningsEvent, EarningsSession } from '@shared/ipc/channels/earnings';

export type Impact = EarningsEvent['impact'];

export const SESSION_LABEL: Record<EarningsSession, { short: string; long: string }> = {
	premarket: { short: 'BMO', long: 'Before the open' },
	intraday: { short: 'DMH', long: 'During market hours' },
	afterhours: { short: 'AMC', long: 'After the close' },
	unspecified: { short: '—', long: 'Time not announced' },
};

/** Today's date in US Eastern time, where earnings dates live. */
export function todayEt(now: number): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/New_York',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now);
}

function addDays(iso: string, days: number): string {
	const d = new Date(`${iso}T00:00:00Z`);
	d.setUTCDate(d.getUTCDate() + days);
	return d.toISOString().slice(0, 10);
}

/** Monday–Friday of the week `offset` weeks from the one containing `today`. */
export function weekRange(today: string, offset: number): { start: string; end: string } {
	const dow = new Date(`${today}T00:00:00Z`).getUTCDay(); // 0 = Sunday
	// On a weekend, "this week" is the coming one: that's what's worth looking at.
	const toMonday = dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow;
	const start = addDays(today, toMonday + offset * 7);
	return { start, end: addDays(start, 4) };
}

const dayFmt = new Intl.DateTimeFormat('en-GB', {
	weekday: 'short',
	day: 'numeric',
	month: 'short',
	timeZone: 'UTC',
});

export function formatDay(iso: string): string {
	return dayFmt.format(new Date(`${iso}T00:00:00Z`));
}

export interface EarningsFilter {
	impacts: Impact[];
	query: string;
}

export function filterEarnings(
	events: readonly EarningsEvent[],
	f: EarningsFilter,
): EarningsEvent[] {
	const q = f.query.trim().toLowerCase();
	return events.filter(
		(e) =>
			f.impacts.includes(e.impact) &&
			(q === '' ||
				e.symbol.toLowerCase().includes(q) ||
				(e.name ?? '').toLowerCase().includes(q)),
	);
}

export interface EarningsDay {
	date: string;
	label: string;
	events: EarningsEvent[];
}

/** Keeps the sidecar's order (session, impact, market cap) inside each day. */
export function groupEarnings(events: readonly EarningsEvent[]): EarningsDay[] {
	const days = new Map<string, EarningsEvent[]>();
	for (const e of events) days.set(e.date, [...(days.get(e.date) ?? []), e]);
	return [...days]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([date, list]) => ({ date, label: formatDay(date), events: list }));
}

export function formatCap(cap: number | null): string {
	if (cap === null) return '';
	if (cap >= 1e12) return `$${(cap / 1e12).toFixed(2)}T`;
	if (cap >= 1e9) return `$${(cap / 1e9).toFixed(cap >= 1e11 ? 0 : 1)}B`;
	return `$${(cap / 1e6).toFixed(0)}M`;
}
