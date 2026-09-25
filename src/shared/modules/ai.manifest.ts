import { defineManifest } from './types';

export const manifest = defineManifest({
	id: 'ai',
	name: 'AI Chat',
	description:
		'Chat with Claude, OpenAI or Gemini about the current file, selection or git diff; apply code via a diff preview.',
	room: 'build',
	requiredSecrets: [
		{
			key: 'anthropic.key',
			label: 'Anthropic API key',
			help: 'console.anthropic.com → API keys. Used for Claude models.',
		},
		{
			key: 'openai.key',
			label: 'OpenAI API key',
			help: 'platform.openai.com → API keys.',
		},
		{
			key: 'gemini.key',
			label: 'Google Gemini API key',
			help: 'aistudio.google.com → Get API key.',
		},
	],
	defaultEnabled: true,
});
