import type { PullSummary, WorkflowRun } from '@shared/ipc/channels/github';
import type { NewNotification } from '@shared/notifications';

export interface WatchState {
	/** run id → status last seen. */
	runs: Map<number, string>;
	/** PR numbers already announced as "review requested". */
	reviews: Set<number>;
}

const ACTIVE = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);

/**
 * What changed since the last poll. The first poll (`prev` null) only records a baseline, so
 * opening Forge doesn't replay a backlog of old runs and reviews.
 */
export function diffWatch(
	prev: WatchState | null,
	runs: readonly WorkflowRun[],
	pulls: readonly PullSummary[],
	viewer: string,
	repo: string,
): { notifications: Array<Omit<NewNotification, 'module'>>; next: WatchState } {
	const next: WatchState = {
		runs: new Map(runs.map((r) => [r.id, r.status])),
		reviews: new Set(pulls.filter((p) => p.reviewRequested).map((p) => p.number)),
	};
	if (!prev) return { notifications: [], next };

	const notifications: Array<Omit<NewNotification, 'module'>> = [];
	for (const run of runs) {
		const before = prev.runs.get(run.id);
		// Only runs we saw running: a run that was already done when first seen isn't news.
		if (run.status !== 'completed' || before === undefined || !ACTIVE.has(before)) continue;
		const where = `${run.name}${run.branch ? ` on ${run.branch}` : ''}`;
		const target = { panelId: 'github.panel', params: { tab: 'actions' } };
		if (run.conclusion === 'failure' || run.conclusion === 'timed_out') {
			notifications.push({
				level: 'error',
				title: `CI failed: ${where}`,
				body: `${repo} · ${run.title}`,
				target,
			});
		} else if (
			run.conclusion === 'success' &&
			run.actor?.toLowerCase() === viewer.toLowerCase()
		) {
			// Your own pushes: you're likely waiting for this one.
			notifications.push({
				level: 'success',
				title: `CI passed: ${where}`,
				body: `${repo} · ${run.title}`,
				target,
			});
		}
	}
	for (const pull of pulls) {
		if (!pull.reviewRequested || prev.reviews.has(pull.number)) continue;
		notifications.push({
			level: 'info',
			title: `Review requested: #${pull.number}`,
			body: `${pull.title} — by ${pull.author.login}`,
			target: { panelId: 'github.pr', params: { number: pull.number } },
		});
	}
	return { notifications, next };
}
