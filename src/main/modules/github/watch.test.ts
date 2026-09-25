import { describe, expect, it } from 'vitest';

import type { PullSummary, WorkflowRun } from '@shared/ipc/channels/github';

import { diffWatch } from './watch';

const run = (
	id: number,
	status: string,
	conclusion: string | null,
	actor = 'marto',
): WorkflowRun => ({
	id,
	name: 'CI',
	title: 'feat: chart',
	event: 'push',
	status,
	conclusion,
	branch: 'main',
	sha: 'abc',
	actor,
	runNumber: id,
	createdAt: 0,
	updatedAt: 0,
	url: 'u',
});

const pull = (number: number, reviewRequested: boolean): PullSummary => ({
	number,
	title: 'Fix it',
	author: { login: 'alice', avatarUrl: null },
	state: 'open',
	draft: false,
	headRef: 'x',
	baseRef: 'main',
	createdAt: 0,
	updatedAt: 0,
	comments: 0,
	labels: [],
	url: 'u',
	reviewRequested,
});

describe('diffWatch', () => {
	it('records a baseline on the first poll without notifying', () => {
		const { notifications, next } = diffWatch(
			null,
			[run(1, 'completed', 'failure')],
			[pull(3, true)],
			'marto',
			'o/r',
		);
		expect(notifications).toEqual([]);
		expect(next.reviews.has(3)).toBe(true);
	});

	it('announces runs that finished while watched, and new review requests', () => {
		const { next: base } = diffWatch(
			null,
			[
				run(1, 'in_progress', null),
				run(2, 'queued', null),
				run(3, 'in_progress', null, 'bot'),
				run(4, 'completed', 'failure'),
			],
			[pull(7, true)],
			'marto',
			'o/r',
		);
		const { notifications } = diffWatch(
			base,
			[
				run(1, 'completed', 'failure'),
				run(2, 'completed', 'success'),
				run(3, 'completed', 'success', 'bot'), // someone else's green run: quiet
				run(4, 'completed', 'failure'), // already done before: quiet
				run(5, 'completed', 'failure'), // first seen already done: quiet
			],
			[pull(7, true), pull(8, true), pull(9, false)],
			'Marto',
			'o/r',
		);
		expect(notifications.map((n) => [n.level, n.title])).toEqual([
			['error', 'CI failed: CI on main'],
			['success', 'CI passed: CI on main'],
			['info', 'Review requested: #8'],
		]);
		expect(notifications[2]?.target).toEqual({ panelId: 'github.pr', params: { number: 8 } });
	});
});
