import { homedir } from 'node:os';

import { spawn } from 'node-pty';

import { manifest } from '@shared/modules/terminal.manifest';

import type { MainModule } from '../../core/modules/types';
import { launchSpec, listPresets } from './presets';
import { type SpawnPty, TerminalSessions } from './terminal-sessions';

const spawnPty: SpawnPty = (spec, { cwd, cols, rows }) =>
	spawn(spec.file, spec.args, {
		name: 'xterm-256color',
		cwd,
		cols,
		rows,
		env: { ...process.env, ...spec.env } as Record<string, string>,
		// ConPTY is the modern Windows console backend (Windows 10 1809+).
		useConpty: true,
	});

export const mainModule: MainModule = {
	manifest,
	activate(ctx) {
		const live = new TerminalSessions(spawnPty, {
			onData: (sessionId, data) => ctx.emit('terminal:data', { sessionId, data }),
			onExit: (sessionId, exitCode) => ctx.emit('terminal:exit', { sessionId, exitCode }),
		});
		const cwd = (): string => ctx.workspace.root() ?? homedir();

		const startSession = async (
			sessionId: string,
			preset: Parameters<typeof launchSpec>[0],
			cols: number,
			rows: number,
		): Promise<void> => {
			const spec = await launchSpec(preset, ctx.workspace.root());
			live.start(sessionId, preset, spec, cwd(), cols, rows);
			ctx.log.info('terminal started', { preset, cwd: cwd() });
		};

		ctx.ipc.handle('terminal:presets', () => listPresets(ctx.workspace.root()));
		ctx.ipc.handle('terminal:open', async ({ sessionId, preset, cols, rows }) => {
			if (!live.has(sessionId)) await startSession(sessionId, preset, cols, rows);
			else live.resize(sessionId, cols, rows);
			const s = live.get(sessionId);
			return {
				sessionId,
				title: s?.title ?? preset,
				cwd: s?.cwd ?? cwd(),
				backlog: s?.backlog ?? '',
				running: Boolean(s?.pty),
			};
		});
		ctx.ipc.handle('terminal:write', ({ sessionId, data }) => live.write(sessionId, data));
		ctx.ipc.handle('terminal:resize', ({ sessionId, cols, rows }) =>
			live.resize(sessionId, cols, rows),
		);
		ctx.ipc.handle('terminal:restart', async ({ sessionId, cols, rows }) => {
			const s = live.get(sessionId);
			if (!s || s.pty) return;
			await startSession(sessionId, s.preset, cols, rows);
		});
		ctx.ipc.handle('terminal:kill', (sessionId) => live.kill(sessionId));

		// Disabling the module (or quitting) must not leave shells running.
		ctx.onDispose(() => live.killAll());
	},
};
