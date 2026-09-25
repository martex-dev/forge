import { describe, expect, it } from 'vitest';

import { mapChecks, mapIssues, mapPull, mapRun, type RawPull } from './map';

const pull = (extra: Partial<RawPull> = {}): RawPull => ({
	number: 12,
	title: 'Add chart',
	user: { login: 'marto', avatar_url: 'https://avatars/x' },
	state: 'open',
	draft: false,
	merged_at: null,
	head: { ref: 'phase-1/trade', sha: 'abc' },
	base: { ref: 'main' },
	created_at: '2026-09-25T10:00:00Z',
	updated_at: '2026-09-25T11:00:00Z',
	labels: [{ name: 'trade', color: 'a3ff12' }, 'plain'],
	html_url: 'https://github.com/o/r/pull/12',
	requested_reviewers: [{ login: 'Reviewer' }, null],
	...extra,
});

describe('mapPull', () => {
	it('maps state, labels and review requests (case-insensitive)', () => {
		const p = mapPull(pull(), 'reviewer');
		expect(p).toMatchObject({
			number: 12,
			state: 'open',
			headRef: 'phase-1/trade',
			reviewRequested: true,
			labels: [
				{ name: 'trade', color: 'a3ff12' },
				{ name: 'plain', color: '6b7280' },
			],
		});
		expect(p.updatedAt).toBe(Date.parse('2026-09-25T11:00:00Z'));
		expect(
			mapPull(pull({ state: 'closed', merged_at: '2026-09-25T12:00:00Z' }), null).state,
		).toBe('merged');
		expect(mapPull(pull({ user: null }), null).author.login).toBe('ghost');
	});
});

describe('mapIssues', () => {
	it('drops pull requests the issues endpoint mixes in', () => {
		const base = {
			title: 't',
			user: null,
			state: 'open',
			created_at: '2026-09-25T10:00:00Z',
			updated_at: '2026-09-25T10:00:00Z',
			comments: 0,
			labels: [],
			html_url: 'u',
		};
		const out = mapIssues([
			{ ...base, number: 1, assignees: [{ login: 'a' }, null] },
			{ ...base, number: 2, pull_request: {} },
		]);
		expect(out.map((i) => [i.number, i.assignees])).toEqual([[1, ['a']]]);
	});
});

describe('mapRun / mapChecks', () => {
	it('maps runs', () => {
		const run = mapRun({
			id: 5,
			name: 'CI',
			display_title: 'feat: x',
			event: 'push',
			status: 'completed',
			conclusion: 'failure',
			head_branch: 'main',
			head_sha: 'def',
			actor: { login: 'marto' },
			run_number: 42,
			created_at: '2026-09-25T10:00:00Z',
			updated_at: '2026-09-25T10:05:00Z',
			html_url: 'https://github.com/o/r/actions/runs/5',
		});
		expect(run).toMatchObject({
			name: 'CI',
			title: 'feat: x',
			conclusion: 'failure',
			actor: 'marto',
		});
	});

	it('merges check runs and legacy statuses', () => {
		const checks = mapChecks(
			[{ name: 'App', status: 'completed', conclusion: 'success', html_url: 'x' }],
			[
				{ context: 'vercel', state: 'pending' },
				{ context: 'legacy', state: 'error', target_url: 'y' },
			],
		);
		expect(checks).toEqual([
			{ name: 'App', status: 'completed', conclusion: 'success', url: 'x' },
			{ name: 'vercel', status: 'pending', conclusion: null, url: null },
			{ name: 'legacy', status: 'completed', conclusion: 'failure', url: 'y' },
		]);
	});
});
