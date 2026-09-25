import { describe, expect, it } from 'vitest';

import type { Run, RunStatus } from '@shared/ipc/channels/lab';

import { endedRuns, runNotification } from './run-watch';

const run = (id: string, status: RunStatus, extra: Partial<Run> = {}): Run => ({
	id,
	name: `run-${id}`,
	project: null,
	status,
	error: null,
	startedAt: 0,
	endedAt: 723_000,
	updatedAt: 723_000,
	pid: null,
	host: null,
	script: null,
	lastStep: 99,
	metricKeys: [],
	...extra,
});

describe('endedRuns', () => {
	it('reports runs that ended since the last poll, after the baseline', () => {
		const runs = [
			run('aaaaaaaa', 'finished'),
			run('bbbbbbbb', 'failed'),
			run('cccccccc', 'running'),
		];
		expect(endedRuns(null, runs)).toEqual([]);
		const prev = new Map<string, RunStatus>([
			['aaaaaaaa', 'running'],
			['bbbbbbbb', 'failed'],
			['cccccccc', 'running'],
		]);
		expect(endedRuns(prev, runs).map((r) => r.id)).toEqual(['aaaaaaaa']);
		// Started and finished between two polls.
		expect(endedRuns(prev, [...runs, run('dddddddd', 'finished')]).map((r) => r.id)).toEqual([
			'aaaaaaaa',
			'dddddddd',
		]);
	});
});

describe('runNotification', () => {
	it('maps status to level, links to the run and summarises progress', () => {
		expect(runNotification(run('aaaaaaaa', 'finished'))).toEqual({
			level: 'success',
			title: 'Run finished: run-aaaaaaaa',
			body: 'step 99 · 12m 03s',
			target: { panelId: 'runs.monitor', params: { runId: 'aaaaaaaa' } },
		});
		const failed = runNotification(run('bbbbbbbb', 'failed', { error: 'RuntimeError: OOM' }));
		expect(failed.level).toBe('error');
		expect(failed.body).toBe('RuntimeError: OOM (step 99 · 12m 03s)');
		expect(runNotification(run('cccccccc', 'interrupted')).level).toBe('warn');
	});
});
