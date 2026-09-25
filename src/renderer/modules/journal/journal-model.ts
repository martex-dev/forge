import type { JournalEntry } from '@shared/ipc/channels/journal';
import { entryPnl } from '@shared/journal-math';

// Shared so the Today dashboard computes P/L the same way.
export { entryPnl };

/** Result in R (multiples of the stop distance). Uses prices, so it works without P/L too. */
export function entryR(e: JournalEntry): number | null {
	if (e.status !== 'closed' || e.entry === null || e.stop === null || e.exit === null) {
		return null;
	}
	const risk = Math.abs(e.entry - e.stop);
	if (risk === 0) return null;
	return ((e.exit - e.entry) * (e.side === 'long' ? 1 : -1)) / risk;
}

/** Planned reward:risk from stop and target. */
export function plannedRR(e: JournalEntry): number | null {
	if (e.entry === null || e.stop === null || e.target === null) return null;
	const risk = Math.abs(e.entry - e.stop);
	return risk === 0 ? null : Math.abs(e.target - e.entry) / risk;
}

export interface JournalFilter {
	query: string;
	status: 'all' | JournalEntry['status'];
	tag: string | null;
}

export function filterEntries(entries: JournalEntry[], f: JournalFilter): JournalEntry[] {
	const q = f.query.trim().toLowerCase();
	return entries.filter(
		(e) =>
			(f.status === 'all' || e.status === f.status) &&
			(f.tag === null || e.tags.includes(f.tag)) &&
			(q === '' ||
				e.symbol.toLowerCase().includes(q) ||
				e.setup.toLowerCase().includes(q) ||
				e.notes.toLowerCase().includes(q) ||
				e.tags.some((t) => t.toLowerCase().includes(q))),
	);
}

export function allTags(entries: JournalEntry[]): string[] {
	return [...new Set(entries.flatMap((e) => e.tags))].sort((a, b) => a.localeCompare(b));
}

/** When a trade counts for ordering and the equity curve. */
export function entryTime(e: JournalEntry): number {
	return e.closedAt ?? e.openedAt ?? e.createdAt;
}

export interface GroupStats {
	key: string;
	trades: number;
	winRate: number;
	net: number;
}

export interface JournalStats {
	closed: number;
	/** Closed trades with a computable P/L. */
	scored: number;
	wins: number;
	losses: number;
	winRate: number | null;
	net: number;
	avgWin: number | null;
	avgLoss: number | null;
	profitFactor: number | null;
	expectancy: number | null;
	avgR: number | null;
	maxDrawdown: number;
	best: number | null;
	worst: number | null;
	equity: Array<[number, number]>;
	bySetup: GroupStats[];
	bySymbol: GroupStats[];
}

const avg = (xs: number[]): number | null =>
	xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

function groupBy(
	rows: Array<{ e: JournalEntry; pnl: number }>,
	key: (e: JournalEntry) => string,
): GroupStats[] {
	const groups = new Map<string, number[]>();
	for (const { e, pnl } of rows) {
		const k = key(e) || '—';
		groups.set(k, [...(groups.get(k) ?? []), pnl]);
	}
	return [...groups]
		.map(([k, pnls]) => ({
			key: k,
			trades: pnls.length,
			winRate: pnls.filter((p) => p > 0).length / pnls.length,
			net: pnls.reduce((a, b) => a + b, 0),
		}))
		.sort((a, b) => b.net - a.net);
}

export function computeStats(entries: JournalEntry[]): JournalStats {
	const closed = entries
		.filter((e) => e.status === 'closed')
		.sort((a, b) => entryTime(a) - entryTime(b));
	const rows = closed.flatMap((e) => {
		const pnl = entryPnl(e);
		return pnl === null ? [] : [{ e, pnl }];
	});
	const wins = rows.filter((r) => r.pnl > 0).map((r) => r.pnl);
	const losses = rows.filter((r) => r.pnl < 0).map((r) => r.pnl);
	const grossWin = wins.reduce((a, b) => a + b, 0);
	const grossLoss = -losses.reduce((a, b) => a + b, 0);

	let equity = 0;
	let peak = 0;
	let maxDrawdown = 0;
	const curve: Array<[number, number]> = [];
	for (const r of rows) {
		equity += r.pnl;
		peak = Math.max(peak, equity);
		maxDrawdown = Math.max(maxDrawdown, peak - equity);
		curve.push([entryTime(r.e), equity]);
	}
	const rs = closed.map(entryR).filter((r): r is number => r !== null);
	const pnls = rows.map((r) => r.pnl);

	return {
		closed: closed.length,
		scored: rows.length,
		wins: wins.length,
		losses: losses.length,
		winRate: rows.length ? wins.length / rows.length : null,
		net: equity,
		avgWin: avg(wins),
		avgLoss: avg(losses),
		profitFactor: grossLoss > 0 ? grossWin / grossLoss : null,
		expectancy: avg(pnls),
		avgR: avg(rs),
		maxDrawdown,
		best: pnls.length ? Math.max(...pnls) : null,
		worst: pnls.length ? Math.min(...pnls) : null,
		equity: curve,
		bySetup: groupBy(rows, (e) => e.setup.trim()),
		bySymbol: groupBy(rows, (e) => e.symbol.toUpperCase()),
	};
}

/** Parses a number field: empty means null, anything unparseable means undefined (invalid). */
export function parseNum(text: string): number | null | undefined {
	const t = text.trim().replace(/,/g, '');
	if (t === '') return null;
	const n = Number(t);
	return Number.isFinite(n) ? n : undefined;
}

export function parseTags(text: string): string[] {
	const tags = text
		.split(/[,\s]+/)
		.map((t) => t.replace(/^#/, '').trim().slice(0, 30))
		.filter(Boolean);
	return [...new Set(tags)].slice(0, 20);
}

export function newEntry(id: string, now: number, init: Partial<JournalEntry> = {}): JournalEntry {
	return {
		id,
		symbol: '',
		market: 'crypto',
		side: 'long',
		status: 'open',
		entry: null,
		exit: null,
		size: null,
		stop: null,
		target: null,
		pnl: null,
		fees: 0,
		openedAt: now,
		closedAt: null,
		setup: '',
		tags: [],
		notes: '',
		images: [],
		createdAt: now,
		updatedAt: now,
		...init,
	};
}
