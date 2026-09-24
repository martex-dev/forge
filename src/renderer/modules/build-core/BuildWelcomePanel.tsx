import { Code2 } from 'lucide-react';
import type { JSX } from 'react';

import { RoomWelcome } from '../../rooms/RoomWelcome';

export function BuildWelcomePanel(): JSX.Element {
	return (
		<RoomWelcome
			room='build'
			icon={Code2}
			heading='Build'
			tagline='Write, run and ship code without leaving Forge.'
			items={[
				{
					title: 'File tree + Monaco editor',
					detail: 'Open a folder, tabs, Ctrl+S.',
					phase: 1,
				},
				{
					title: 'Terminals with AI presets',
					detail: 'PowerShell, Python venv, Claude Code, Codex, Gemini CLI.',
					phase: 1,
				},
				{ title: 'Git panel', detail: 'Diff, stage, commit, pull/push.', phase: 1 },
				{
					title: 'LSP + workspace search',
					detail: 'basedpyright, tsserver, ripgrep.',
					phase: 2,
				},
				{
					title: 'GitHub + Vercel',
					detail: 'PRs, Actions, deployments and logs.',
					phase: 2,
				},
				{ title: 'AI chat with file context', detail: 'Claude, OpenAI, Gemini.', phase: 2 },
			]}
		/>
	);
}
