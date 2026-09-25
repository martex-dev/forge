import { FileSpreadsheet, FolderOpen } from 'lucide-react';

import { manifest } from '@shared/modules/frames.manifest';

import { call } from '../../lib/ipc';
import type { CommandContext, RendererModule } from '../types';
import { basename, instanceIdFor } from './frame-model';
import { FramePanel } from './FramePanel';

const VIEWER = 'frames.viewer';

/** One tab per file: opening a file that's already open focuses its tab. */
export function openFrame(ctx: CommandContext, path: string): void {
	ctx.openPanel(VIEWER, {
		instanceId: instanceIdFor(path),
		title: basename(path),
		params: { path },
	});
}

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: VIEWER,
			title: 'Data',
			room: 'lab',
			icon: FileSpreadsheet,
			component: FramePanel,
			tabWith: 'runs.monitor',
		},
	],
	commands: [
		{
			id: 'frames.open',
			title: 'Lab: Open Data File…',
			room: 'lab',
			shortcut: 'Ctrl+Alt+O',
			keywords: ['dataframe', 'csv', 'parquet', 'feather', 'duckdb', 'table', 'sql'],
			icon: FolderOpen,
			run: async (ctx) => {
				const path = await call('frames:pick');
				if (path) openFrame(ctx, path);
			},
		},
		{
			id: 'frames.viewer',
			title: 'Lab: DataFrame Viewer',
			room: 'lab',
			keywords: ['dataframe', 'data', 'recent', 'duckdb'],
			icon: FileSpreadsheet,
			run: (ctx) => ctx.openPanel(VIEWER),
		},
	],
};
