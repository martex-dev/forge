import { describe, expect, it } from 'vitest';

import type { ForgeNotification } from '@shared/notifications';

import {
	dayLabel,
	DEFAULT_FILTERS,
	filterNotifications,
	groupByDay,
	modulesIn,
} from './inbox-model';

const NOW = new Date(2026, 8, 25, 15, 0).getTime();
const HOUR = 3_600_000;

const n = (id: string, overrides: Partial<ForgeNotification> = {}): ForgeNotification => ({
	id,
	module: 'runs',
	title: id,
	body: '',
	level: 'info',
	read: false,
	createdAt: NOW - HOUR,
	target: null,
	...overrides,
});

describe('filterNotifications', () => {
	const list = [
		n('a', { level: 'error' }),
		n('b', { level: 'info', read: true, module: 'sidecar' }),
		n('c', { level: 'warn', module: 'sidecar' }),
	];

	it('filters by level, module and unread', () => {
		expect(filterNotifications(list, DEFAULT_FILTERS).map((x) => x.id)).toEqual([
			'a',
			'b',
			'c',
		]);
		expect(
			filterNotifications(list, { ...DEFAULT_FILTERS, levels: ['warn', 'error'] }).map(
				(x) => x.id,
			),
		).toEqual(['a', 'c']);
		expect(
			filterNotifications(list, {
				...DEFAULT_FILTERS,
				module: 'sidecar',
				unreadOnly: true,
			}).map((x) => x.id),
		).toEqual(['c']);
	});

	it('lists distinct modules', () => {
		expect(modulesIn(list)).toEqual(['runs', 'sidecar']);
	});
});

describe('groupByDay', () => {
	it('groups newest first under Today / Yesterday / dates', () => {
		const groups = groupByDay(
			[
				n('old', { createdAt: NOW - 3 * 24 * HOUR }),
				n('today', { createdAt: NOW - HOUR }),
				n('yday', { createdAt: NOW - 20 * HOUR }),
				n('newest', { createdAt: NOW - 60_000 }),
			],
			NOW,
		);
		expect(groups.map((g) => [g.label, g.items.map((x) => x.id)])).toEqual([
			['Today', ['newest', 'today']],
			['Yesterday', ['yday']],
			['Tue 22 Sep', ['old']],
		]);
	});

	it('labels days in local time', () => {
		expect(dayLabel(new Date(2026, 8, 25, 0, 1).getTime(), NOW)).toBe('Today');
		expect(dayLabel(new Date(2026, 8, 24, 23, 59).getTime(), NOW)).toBe('Yesterday');
	});
});
