import type { Deployment } from '@shared/ipc/channels/vercel';
import type { NewNotification } from '@shared/notifications';

const ACTIVE = new Set(['QUEUED', 'INITIALIZING', 'BUILDING']);

/**
 * Deployments that finished since the last poll: failures (any target) and production going live.
 * The first poll (`prev` null) is the baseline.
 */
export function diffDeployments(
	prev: ReadonlyMap<string, string> | null,
	deployments: readonly Deployment[],
): { notifications: Array<Omit<NewNotification, 'module'>>; next: Map<string, string> } {
	const next = new Map(deployments.map((d) => [d.id, d.state]));
	if (!prev) return { notifications: [], next };
	const notifications: Array<Omit<NewNotification, 'module'>> = [];
	for (const d of deployments) {
		const before = prev.get(d.id);
		// Seen building (or brand new and already finished): a short build can finish between polls.
		const fresh = before === undefined || ACTIVE.has(before);
		if (!fresh || ACTIVE.has(d.state)) continue;
		const where = `${d.project}${d.commitRef ? ` (${d.commitRef})` : ''}`;
		const target = {
			panelId: 'vercel.deployment',
			params: { deploymentId: d.id, projectId: d.projectId },
		};
		if (d.state === 'ERROR') {
			notifications.push({
				level: 'error',
				title: `Vercel build failed: ${where}`,
				body: d.commitMessage ?? d.url,
				target,
			});
		} else if (d.state === 'READY' && d.target === 'production') {
			notifications.push({
				level: 'success',
				title: `Live on production: ${d.project}`,
				body: d.commitMessage ?? d.url,
				target,
			});
		}
	}
	return { notifications, next };
}
