import type { GitHubRepo } from '@shared/ipc/channels/github';
import { manifest } from '@shared/modules/github.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';
import { GitHubService, repoOfFolder, type RepoRef } from './github-service';
import { diffWatch, type WatchState } from './watch';

// Actions and review requests change on a scale of minutes; this stays far under the 5 000/h quota.
const WATCH_MS = 90_000;

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		// e2e points the module at a local mock API; never honoured outside test runs.
		const mockApi =
			process.env['FORGE_E2E'] === '1' ? process.env['FORGE_GITHUB_API'] : undefined;
		const github = new GitHubService(() => ctx.getSecret('github.token'), mockApi);
		let repoPromise: Promise<RepoRef | null> | null = null;
		let watchState: WatchState | null = null;

		const repoRef = (): Promise<RepoRef | null> => {
			const root = ctx.workspace.root();
			if (!root) return Promise.resolve(null);
			repoPromise ??= repoOfFolder(root);
			return repoPromise;
		};
		const requireRepo = async (): Promise<RepoRef> => {
			const ref = await repoRef();
			if (!ref)
				throw new ForgeError('GITHUB_NO_REPO', 'The open folder has no GitHub remote');
			return ref;
		};
		ctx.workspace.onChange(() => {
			repoPromise = null;
			watchState = null;
		});

		ctx.ipc.handle('github:repo', async (): Promise<GitHubRepo> => {
			if (!ctx.workspace.root()) return { status: 'no-folder' };
			const ref = await repoRef();
			if (!ref) return { status: 'no-remote' };
			if (!github.hasToken()) return { status: 'no-token', ...ref };
			return { status: 'ok', ...ref, ...(await github.info(ref)) };
		});
		ctx.ipc.handle('github:pulls', async ({ state }) =>
			github.pulls(await requireRepo(), state),
		);
		ctx.ipc.handle('github:pull', async ({ number }) =>
			github.pull(await requireRepo(), number),
		);
		ctx.ipc.handle('github:issues', async ({ state }) =>
			github.issues(await requireRepo(), state),
		);
		ctx.ipc.handle('github:runs', async () => github.runs(await requireRepo()));

		let lastError = '';
		const poll = async (): Promise<void> => {
			const ref = await repoRef();
			if (!ref || !github.hasToken()) return;
			try {
				const [runs, pulls, viewer] = await Promise.all([
					github.runs(ref),
					github.pulls(ref, 'open'),
					github.viewer(),
				]);
				const result = diffWatch(
					watchState,
					runs,
					pulls,
					viewer,
					`${ref.owner}/${ref.repo}`,
				);
				for (const n of result.notifications) ctx.notify(n);
				watchState = result.next;
				lastError = '';
			} catch (error) {
				// Offline or a bad token: say it once in the log, not every 90 s.
				const message = error instanceof Error ? error.message : String(error);
				if (message !== lastError) ctx.log.warn('github watch failed', { message });
				lastError = message;
			}
		};
		const timer = setInterval(() => void poll(), WATCH_MS);
		ctx.onDispose(() => clearInterval(timer));
	},
};
