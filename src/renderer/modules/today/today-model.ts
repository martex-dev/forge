import type { CalendarEvent } from '@shared/ipc/channels/calendar';
import type { EarningsEvent } from '@shared/ipc/channels/earnings';
import type { WorkflowRun } from '@shared/ipc/channels/github';
import type { JournalEntry } from '@shared/ipc/channels/journal';
import type { Run } from '@shared/ipc/channels/lab';
import type { VercelProject } from '@shared/ipc/channels/vercel';
import { entryPnl } from '@shared/journal-math';

const DAY = 86_400_000;
const startOfDay = (t: number): number => new Date(t).setHours(0, 0, 0, 0);

export function greeting(now: number): string {
	const h = new Date(now).getHours();
	return h < 5
		? 'Late night'
		: h < 12
			? 'Good morning'
			: h < 18
				? 'Good afternoon'
				: 'Good evening';
}

/** Today's high/medium-impact macro events (local day), and the next one still to come. */
export function macroToday(
	events: readonly CalendarEvent[],
	now: number,
): { events: CalendarEvent[]; next: CalendarEvent | null } {
	const from = startOfDay(now);
	const today = events
		.filter(
			(e) =>
				e.time >= from &&
				e.time < from + DAY &&
				(e.impact === 'high' || e.impact === 'medium'),
		)
		.sort((a, b) => a.time - b.time);
	return { events: today, next: today.find((e) => e.time > now) ?? null };
}

/** Today's earnings (US Eastern date), most important first. */
export function earningsToday(events: readonly EarningsEvent[], todayEt: string): EarningsEvent[] {
	const rank = { high: 0, medium: 1, low: 2 } as const;
	return events
		.filter((e) => e.date === todayEt)
		.sort((a, b) => rank[a.impact] - rank[b.impact] || (b.marketCap ?? 0) - (a.marketCap ?? 0));
}

export interface JournalToday {
	trades: number;
	pnl: number;
	wins: number;
	open: number;
}

/** Trades closed today (local day) and their net P/L; open trades right now. */
export function journalToday(entries: readonly JournalEntry[], now: number): JournalToday {
	const from = startOfDay(now);
	const closed = entries.filter((e) => e.status === 'closed' && (e.closedAt ?? 0) >= from);
	const pnls = closed.map(entryPnl).filter((p): p is number => p !== null);
	return {
		trades: closed.length,
		pnl: pnls.reduce((a, b) => a + b, 0),
		wins: pnls.filter((p) => p > 0).length,
		open: entries.filter((e) => e.status === 'open').length,
	};
}

export interface RunsToday {
	running: Run[];
	finished: number;
	failed: Run[];
}

/** What trained in the last 24 h: running now, finished, and failures worth a look. */
export function runsToday(runs: readonly Run[], now: number): RunsToday {
	const recent = runs.filter((r) => (r.endedAt ?? r.updatedAt) >= now - DAY);
	return {
		running: runs.filter((r) => r.status === 'running'),
		finished: recent.filter((r) => r.status === 'finished').length,
		failed: recent.filter((r) => r.status === 'failed'),
	};
}

/** The latest run per workflow that failed: what's red on the default branch right now. */
export function failingWorkflows(runs: readonly WorkflowRun[]): WorkflowRun[] {
	const latest = new Map<string, WorkflowRun>();
	for (const r of runs) {
		const seen = latest.get(r.name);
		if (!seen || r.createdAt > seen.createdAt) latest.set(r.name, r);
	}
	return [...latest.values()].filter(
		(r) => r.status === 'completed' && r.conclusion === 'failure',
	);
}

/** Production deployments that aren't healthy (failed or still building). */
export function deploysNeedingAttention(projects: readonly VercelProject[]): VercelProject[] {
	return projects.filter((p) => p.production && p.production.state !== 'READY');
}

/** Today in US Eastern time, where earnings dates live. */
export function todayEt(now: number): string {
	return new Intl.DateTimeFormat('en-CA', {
		timeZone: 'America/New_York',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
	}).format(now);
}

/** Monday–Friday containing `today` (weekends look at the coming week). */
export function etWeek(today: string): { start: string; end: string } {
	const d = new Date(`${today}T00:00:00Z`);
	const dow = d.getUTCDay();
	d.setUTCDate(d.getUTCDate() + (dow === 0 ? 1 : dow === 6 ? 2 : 1 - dow));
	const start = d.toISOString().slice(0, 10);
	d.setUTCDate(d.getUTCDate() + 4);
	return { start, end: d.toISOString().slice(0, 10) };
}
