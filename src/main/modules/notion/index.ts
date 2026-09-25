import { manifest } from '@shared/modules/notion.manifest';

import { ForgeError } from '../../core/errors';
import type { MainModule } from '../../core/modules/types';
import { NotionClient } from './notion-client';

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const base = process.env['FORGE_E2E'] === '1' ? process.env['FORGE_NOTION_API'] : undefined;
		const client = (): NotionClient => {
			const token = ctx.getSecret('notion.token');
			if (!token) {
				throw new ForgeError(
					'NOTION_NO_TOKEN',
					'Add your Notion integration token in Settings → Secrets',
				);
			}
			return new NotionClient(token, base);
		};
		ctx.ipc.handle('notion:status', () => ({
			hasToken: Boolean(ctx.getSecret('notion.token')),
		}));
		ctx.ipc.handle('notion:search', ({ query }) => client().search(query));
		ctx.ipc.handle('notion:page', (id) => client().page(id));
		ctx.ipc.handle('notion:append', ({ id, kind, text }) => client().append(id, kind, text));
		ctx.ipc.handle('notion:create', ({ parentId, title }) => client().create(parentId, title));
	},
};
