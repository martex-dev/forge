import { manifest } from '@shared/modules/search.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';
import { Ripgrep } from './ripgrep';

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const rg = new Ripgrep();
		ctx.onDispose(() => rg.cancel());
		// Closing or switching folders makes a running search meaningless.
		ctx.workspace.onChange(() => rg.cancel());

		ctx.ipc.handle('search:run', (query) => {
			const root = ctx.workspace.root();
			if (!root) throw new ForgeError('SEARCH_NO_FOLDER', 'Open a folder to search in');
			return rg.search(root, query);
		});
	},
};
