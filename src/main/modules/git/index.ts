import { manifest } from '@shared/modules/git.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';
import { GitService } from './git-service';

/** git prints useful reasons on stderr; keep the first lines, drop noise and hints. */
function gitError(error: unknown): ForgeError {
	if (error instanceof ForgeError) return error;
	const raw = error instanceof Error ? error.message : String(error);
	const message = raw
		.split(/\r?\n/)
		.filter((l) => l.trim() && !l.startsWith('hint:'))
		.slice(0, 4)
		.join('\n');
	return new ForgeError('GIT_FAILED', message || 'git failed', error);
}

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const service = new GitService(() => ctx.workspace.root());
		ctx.workspace.onChange(() => service.reset());
		const changed = (): void => ctx.emit('git:changed', {});
		const run = async <T>(op: () => Promise<T>, notifies = true): Promise<T> => {
			try {
				const result = await op();
				if (notifies) changed();
				return result;
			} catch (error) {
				throw gitError(error);
			}
		};

		ctx.ipc.handle('git:status', () => run(() => service.status(), false));
		ctx.ipc.handle('git:diff', ({ path, staged, from }) =>
			run(async () => ({ path, ...(await service.diff(path, staged, from)) }), false),
		);
		ctx.ipc.handle('git:stage', (paths) => run(() => service.stage(paths)));
		ctx.ipc.handle('git:unstage', (paths) => run(() => service.unstage(paths)));
		ctx.ipc.handle('git:commit', ({ message }) => run(() => service.commit(message)));
		ctx.ipc.handle('git:pull', () => run(() => service.pull()));
		ctx.ipc.handle('git:push', () => run(() => service.push()));
	},
};
