import type { Run, RunStatus } from '@shared/ipc/channels/lab';
import type { NewNotification } from '@shared/notifications';

/**
 * Runs that ended since the previous poll: were running, or are new and already over (a short
 * script can start and finish between polls). `prev` null = first look, which is the baseline.
 */
export function endedRuns(
	prev: ReadonlyMap<string, RunStatus> | null,
	runs: readonly Run[],
): Run[] {
	if (!prev) return [];
	return runs.filter(
		(r) => r.status !== 'running' && (prev.get(r.id) === 'running' || !prev.has(r.id)),
	);
}

function duration(run: Run): string {
	const s = Math.max(0, Math.round(((run.endedAt ?? run.updatedAt) - run.startedAt) / 1000));
	const pad = (n: number): string => String(n).padStart(2, '0');
	if (s < 3600) return `${Math.floor(s / 60)}m ${pad(s % 60)}s`;
	return `${Math.floor(s / 3600)}h ${pad(Math.floor((s % 3600) / 60))}m`;
}

export function runNotification(run: Run): Omit<NewNotification, 'module'> {
	const where = `step ${run.lastStep ?? 0} · ${duration(run)}`;
	const target = { panelId: 'runs.monitor', params: { runId: run.id } };
	switch (run.status) {
		case 'failed':
			return {
				level: 'error',
				title: `Run failed: ${run.name}`,
				body: `${run.error ?? 'Unknown error'} (${where})`,
				target,
			};
		case 'interrupted':
			return {
				level: 'warn',
				title: `Run interrupted: ${run.name}`,
				body: `The script stopped without finishing (${where}).`,
				target,
			};
		default:
			return { level: 'success', title: `Run finished: ${run.name}`, body: where, target };
	}
}
