import { z } from 'zod';

import { manifest } from '@shared/modules/vercel.manifest';

import type { MainModule } from '../../core/modules/types';
import { VercelClient } from './vercel-client';
import { diffDeployments } from './watch';

const TeamSchema = z.string().nullable();
const WATCH_MS = 60_000;

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		// e2e points the module at a local mock API; never honoured outside test runs.
		const mockApi =
			process.env['FORGE_E2E'] === '1' ? process.env['FORGE_VERCEL_API'] : undefined;
		const vercel = new VercelClient(() => ctx.getSecret('vercel.token'), mockApi);
		const teamId = (): string | null => ctx.settings.get('teamId', TeamSchema, null);
		// Deployment states from the last poll (null until the first one = baseline).
		let known: Map<string, string> | null = null;

		ctx.ipc.handle('vercel:status', async () => {
			if (!vercel.hasToken()) return { status: 'no-token' as const };
			const [user, teams] = await Promise.all([vercel.user(), vercel.teams()]);
			return { status: 'ok' as const, user, teams, teamId: teamId() };
		});
		ctx.ipc.handle('vercel:setTeam', ({ teamId: next }) => {
			ctx.settings.set('teamId', TeamSchema, next);
			known = null;
		});
		ctx.ipc.handle('vercel:projects', () => vercel.projects(teamId()));
		ctx.ipc.handle('vercel:deployments', ({ projectId }) =>
			vercel.deployments(projectId, teamId()),
		);
		ctx.ipc.handle('vercel:buildLogs', ({ deploymentId }) =>
			vercel.buildLogs(deploymentId, teamId()),
		);
		ctx.ipc.handle('vercel:runtimeLogs', ({ projectId, deploymentId }) =>
			vercel.runtimeLogs(projectId, deploymentId, teamId()),
		);
		ctx.ipc.handle('vercel:promote', async ({ projectId, deploymentId }) => {
			ctx.log.info('promoting deployment', { projectId, deploymentId });
			await vercel.promote(projectId, deploymentId, teamId());
		});
		ctx.ipc.handle('vercel:rollback', async ({ projectId, deploymentId }) => {
			ctx.log.info('rolling back to deployment', { projectId, deploymentId });
			await vercel.rollback(projectId, deploymentId, teamId());
		});

		let lastError = '';
		const poll = async (): Promise<void> => {
			if (!vercel.hasToken()) return;
			try {
				const result = diffDeployments(known, await vercel.recentDeployments(teamId()));
				for (const n of result.notifications) ctx.notify(n);
				known = result.next;
				lastError = '';
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);
				if (message !== lastError) ctx.log.warn('vercel watch failed', { message });
				lastError = message;
			}
		};
		const timer = setInterval(() => void poll(), WATCH_MS);
		ctx.onDispose(() => clearInterval(timer));
	},
};
