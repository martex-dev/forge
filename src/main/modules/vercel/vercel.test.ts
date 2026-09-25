import { describe, expect, it } from 'vitest';

import type { Deployment } from '@shared/ipc/channels/vercel';

import { mapBuildEvents, mapDeployment, mapProject, mapRuntimeLine, toState } from './map';
import { diffDeployments } from './watch';

describe('mappers', () => {
	it('maps projects with their production target and git link', () => {
		const p = mapProject({
			id: 'prj_1',
			name: 'market-calendar',
			framework: 'nextjs',
			updatedAt: 5,
			link: { type: 'github', org: 'martex-dev', repo: 'market-calendar' },
			targets: {
				production: {
					id: 'dpl_9',
					url: 'mc.vercel.app',
					readyState: 'READY',
					createdAt: 4,
				},
			},
		});
		expect(p).toEqual({
			id: 'prj_1',
			name: 'market-calendar',
			framework: 'nextjs',
			repo: 'martex-dev/market-calendar',
			production: { id: 'dpl_9', url: 'https://mc.vercel.app', state: 'READY', createdAt: 4 },
			updatedAt: 5,
		});
		expect(mapProject({ id: 'p', name: 'x' }).production).toBeNull();
	});

	it('maps deployments (v6 list shape) and marks the live one', () => {
		const d = mapDeployment(
			{
				uid: 'dpl_9',
				name: 'market-calendar',
				url: 'mc-abc.vercel.app',
				state: 'BUILDING',
				target: null,
				created: 10,
				projectId: 'prj_1',
				creator: { username: 'marto' },
				meta: {
					githubCommitMessage: 'fix: nfp',
					githubCommitRef: 'main',
					githubCommitSha: 'abc',
				},
			},
			'dpl_9',
		);
		expect(d).toMatchObject({
			id: 'dpl_9',
			url: 'https://mc-abc.vercel.app',
			state: 'BUILDING',
			target: 'preview',
			commitMessage: 'fix: nfp',
			creator: 'marto',
			isCurrentProduction: true,
		});
		expect(toState('weird')).toBe('UNKNOWN');
	});

	it('reads both build event shapes and runtime NDJSON', () => {
		expect(
			mapBuildEvents([
				{ type: 'command', created: 1, text: 'npm run build\n' },
				{ type: 'stderr', payload: { text: 'Error: x', date: 2 } },
				{ type: 'delimiter' },
			]),
		).toEqual([
			{ t: 1, level: 'info', text: 'npm run build' },
			{ t: 2, level: 'error', text: 'Error: x' },
		]);
		expect(
			mapRuntimeLine(
				'{"level":"error","message":"boom","timestampInMs":3,"requestMethod":"POST","requestPath":"/api/x","responseStatusCode":500}',
			),
		).toEqual({ t: 3, level: 'error', text: 'POST /api/x 500 · boom' });
		expect(mapRuntimeLine('not json')).toBeNull();
	});
});

const dep = (
	id: string,
	state: string,
	target: 'production' | 'preview' = 'preview',
): Deployment => ({
	id,
	projectId: 'prj_1',
	project: 'site',
	url: 'https://x',
	state: state as Deployment['state'],
	target,
	createdAt: 0,
	commitMessage: 'feat: y',
	commitRef: 'main',
	commitSha: null,
	creator: null,
	inspectorUrl: null,
	isCurrentProduction: false,
});

describe('diffDeployments', () => {
	it('notifies failures and production going live, after the baseline', () => {
		const { next } = diffDeployments(null, [
			dep('a', 'BUILDING'),
			dep('b', 'BUILDING', 'production'),
			dep('c', 'READY'),
		]);
		const { notifications } = diffDeployments(next, [
			dep('a', 'ERROR'),
			dep('b', 'READY', 'production'),
			dep('c', 'READY'), // already finished: quiet
			dep('d', 'ERROR'), // new and already failed: still news
			dep('e', 'READY'), // new preview ready: quiet
		]);
		expect(notifications.map((n) => [n.level, n.title])).toEqual([
			['error', 'Vercel build failed: site (main)'],
			['success', 'Live on production: site'],
			['error', 'Vercel build failed: site (main)'],
		]);
	});
});
