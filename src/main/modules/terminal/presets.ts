import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, join } from 'node:path';

import type { TerminalPreset, TerminalPresetId } from '@shared/ipc/channels/terminal';

export interface LaunchSpec {
	file: string;
	args: string[];
	env: Record<string, string>;
	title: string;
}

const CLI_PRESETS: Record<
	'claude' | 'codex' | 'gemini',
	{ label: string; command: string; hint: string }
> = {
	claude: {
		label: 'Claude Code',
		command: 'claude',
		hint: 'npm install -g @anthropic-ai/claude-code',
	},
	codex: { label: 'Codex CLI', command: 'codex', hint: 'npm install -g @openai/codex' },
	gemini: { label: 'Gemini CLI', command: 'gemini', hint: 'npm install -g @google/gemini-cli' },
};

/** Resolves a command on PATH via where.exe (Windows) / which. Cached briefly. */
const whichCache = new Map<string, { at: number; path: string | null }>();
export function which(command: string): Promise<string | null> {
	const hit = whichCache.get(command);
	if (hit && Date.now() - hit.at < 30_000) return Promise.resolve(hit.path);
	const tool = process.platform === 'win32' ? 'where.exe' : 'which';
	return new Promise((resolve) => {
		execFile(tool, [command], { windowsHide: true, timeout: 5000 }, (error, stdout) => {
			const path = error ? null : (stdout.split(/\r?\n/).find((l) => l.trim()) ?? null);
			whichCache.set(command, { at: Date.now(), path });
			resolve(path);
		});
	});
}

async function shell(): Promise<string> {
	if (process.platform !== 'win32') return process.env['SHELL'] ?? '/bin/bash';
	// PowerShell 7 if installed, otherwise the built-in Windows PowerShell 5.1.
	return (await which('pwsh.exe')) ? 'pwsh.exe' : 'powershell.exe';
}

export function venvDir(root: string | null): string | null {
	if (!root) return null;
	for (const name of ['.venv', 'venv']) {
		const dir = join(root, name);
		const python = join(dir, process.platform === 'win32' ? 'Scripts' : 'bin');
		if (existsSync(python)) return dir;
	}
	return null;
}

export async function listPresets(root: string | null): Promise<TerminalPreset[]> {
	const venv = venvDir(root);
	const clis = await Promise.all(
		(Object.keys(CLI_PRESETS) as Array<keyof typeof CLI_PRESETS>).map(async (id) => {
			const p = CLI_PRESETS[id];
			const found = await which(p.command);
			return {
				id,
				label: p.label,
				available: Boolean(found),
				installHint: found ? null : p.hint,
				reason: found ? null : `"${p.command}" was not found on PATH.`,
			};
		}),
	);
	return [
		{ id: 'powershell', label: 'PowerShell', available: true, installHint: null, reason: null },
		{
			id: 'python',
			label: 'Python (venv)',
			available: Boolean(venv),
			installHint: venv ? null : 'uv venv',
			reason: venv ? null : 'No .venv or venv folder in the open project.',
		},
		...clis,
	];
}

/**
 * Builds the process to spawn. Only these fixed presets can be launched from the UI; the
 * renderer never supplies a command line.
 */
export async function launchSpec(
	preset: TerminalPresetId,
	root: string | null,
): Promise<LaunchSpec> {
	const sh = await shell();
	const base = { TERM: 'xterm-256color', COLORTERM: 'truecolor', TERM_PROGRAM: 'Forge' };
	const noLogo = process.platform === 'win32' ? ['-NoLogo'] : [];
	switch (preset) {
		case 'powershell':
			return { file: sh, args: noLogo, env: base, title: 'PowerShell' };
		case 'python': {
			const venv = venvDir(root);
			if (!venv) throw new Error('No virtual environment in this folder');
			// Activate by environment instead of running Activate.ps1, so the machine's
			// execution policy never needs to be relaxed.
			const bin = join(venv, process.platform === 'win32' ? 'Scripts' : 'bin');
			return {
				file: sh,
				args: noLogo,
				env: {
					...base,
					VIRTUAL_ENV: venv,
					PATH: `${bin}${delimiter}${process.env['PATH'] ?? ''}`,
				},
				title: 'Python (venv)',
			};
		}
		default: {
			const p = CLI_PRESETS[preset];
			// Run inside the shell so you land back at a prompt when the CLI exits.
			const args =
				process.platform === 'win32'
					? [...noLogo, '-NoExit', '-Command', p.command]
					: ['-c', `${p.command}; exec ${sh}`];
			return { file: sh, args, env: base, title: p.label };
		}
	}
}
