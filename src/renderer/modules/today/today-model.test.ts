import { describe, expect, it } from 'vitest';

import type { CalendarEvent } from '@shared/ipc/channels/calendar';
import type { EarningsEvent } from '@shared/ipc/channels/earnings';
import type { WorkflowRun } from '@shared/ipc/channels/github';
import type { JournalEntry } from '@shared/ipc/channels/journal';
import type { Run } from '@shared/ipc/channels/lab';

import {
	earningsToday,
	failingWorkflows,
	greeting,
	journalToday,
	macroToday,
	runsToday,
} from './today-model';

const NOW = new Date(2026, 8, 25, 14, 0).getTime();
const at = (h: number, dayOffset = 0): number => new Date(2026, 8, 25 + dayOffset, h, 0).getTime();

describe('today model', () => {
	it('greets by time of day', () => {
		expect(greeting(new Date(2026, 8, 25, 9).getTime())).toBe('Good morning');
		expect(greeting(NOW)).toBe('Good afternoon');
		expect(greeting(new Date(2026, 8, 25, 2).getTime())).toBe('Late night');
	});

	it('keeps today’s important macro events and finds the next', () => {
		const ev = (id: string, time: number, impact: CalendarEvent['impact']): CalendarEvent => ({
			id,
			title: id,
			currency: 'USD',
			time,
			impact,
			forecast: null,
			previous: null,
		});
		const r = macroToday(
			[
				ev('cpi', at(15), 'high'),
				ev('claims', at(9), 'medium'),
				ev('low', at(16), 'low'),
				ev('tomorrow', at(9, 1), 'high'),
			],
			NOW,
		);
		expect(r.events.map((e) => e.id)).toEqual(['claims', 'cpi']);
		expect(r.next?.id).toBe('cpi');
	});

	it('ranks today’s earnings by impact then market cap', () => {
		const e = (
			symbol: string,
			impact: EarningsEvent['impact'],
			cap: number,
			date = '2026-09-25',
		): EarningsEvent => ({
			id: symbol,
			date,
			session: 'afterhours',
			symbol,
			name: symbol,
			impact,
			marketCap: cap,
			epsForecast: null,
			epsActual: null,
			epsPrevious: null,
			source: 'nasdaq',
		});
		const list = [
			e('WM', 'medium', 80e9),
			e('NVDA', 'high', 4e12),
			e('KO', 'medium', 250e9),
			e('X', 'high', 1e12, '2026-09-26'),
		];
		expect(earningsToday(list, '2026-09-25').map((x) => x.symbol)).toEqual([
			'NVDA',
			'KO',
			'WM',
		]);
	});

	it('sums today’s closed trades', () => {
		const t = (over: Partial<JournalEntry>): JournalEntry =>
			({
				status: 'closed',
				pnl: null,
				fees: 0,
				entry: null,
				exit: null,
				size: null,
				side: 'long',
				closedAt: at(10),
				...over,
			}) as JournalEntry;
		const r = journalToday(
			[
				t({ pnl: 120 }),
				t({ pnl: -20 }),
				t({ pnl: 50, closedAt: at(10, -1) }),
				t({ status: 'open', closedAt: null }),
			],
			NOW,
		);
		expect(r).toEqual({ trades: 2, pnl: 100, wins: 1, open: 1 });
	});

	it('summarizes the last 24 h of runs', () => {
		const run = (id: string, status: Run['status'], endedAt: number | null): Run =>
			({ id, status, endedAt, updatedAt: endedAt ?? NOW }) as Run;
		const r = runsToday(
			[
				run('a', 'running', null),
				run('b', 'finished', at(8)),
				run('c', 'failed', at(12)),
				run('d', 'finished', at(8, -2)),
			],
			NOW,
		);
		expect(r.running.map((x) => x.id)).toEqual(['a']);
		expect(r.finished).toBe(1);
		expect(r.failed.map((x) => x.id)).toEqual(['c']);
	});

	it('reports workflows whose latest run failed', () => {
		const w = (name: string, createdAt: number, conclusion: string): WorkflowRun =>
			({ name, createdAt, status: 'completed', conclusion }) as WorkflowRun;
		expect(
			failingWorkflows([
				w('CI', 1, 'failure'),
				w('CI', 2, 'success'),
				w('Deploy', 3, 'failure'),
			]).map((r) => r.name),
		).toEqual(['Deploy']);
	});
});
