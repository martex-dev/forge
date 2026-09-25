import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'terminal',
	name: 'Terminals',
	description:
		'PowerShell, Python venv, Claude Code, Codex and Gemini CLI terminals (node-pty + xterm).',
	room: 'build',
	defaultEnabled: true,
});
