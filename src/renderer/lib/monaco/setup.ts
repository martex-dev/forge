// Language grammars and the default themes are VS Code extensions; importing registers them.
import { initialize } from '@codingame/monaco-vscode-api';
import getConfigurationServiceOverride, {
	updateUserConfiguration,
} from '@codingame/monaco-vscode-configuration-service-override';
import getLanguagesServiceOverride from '@codingame/monaco-vscode-languages-service-override';
import getTextmateServiceOverride from '@codingame/monaco-vscode-textmate-service-override';
import TextMateWorker from '@codingame/monaco-vscode-textmate-service-override/worker?worker';
import getThemeServiceOverride from '@codingame/monaco-vscode-theme-service-override';
import * as monaco from 'monaco-editor';
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';

import '@codingame/monaco-vscode-theme-defaults-default-extension';
import '@codingame/monaco-vscode-typescript-basics-default-extension';
import '@codingame/monaco-vscode-javascript-default-extension';
import '@codingame/monaco-vscode-python-default-extension';
import '@codingame/monaco-vscode-json-default-extension';
import '@codingame/monaco-vscode-css-default-extension';
import '@codingame/monaco-vscode-html-default-extension';
import '@codingame/monaco-vscode-markdown-basics-default-extension';
import '@codingame/monaco-vscode-yaml-default-extension';
import '@codingame/monaco-vscode-powershell-default-extension';
import '@codingame/monaco-vscode-shellscript-default-extension';
import '@codingame/monaco-vscode-bat-default-extension';
import '@codingame/monaco-vscode-sql-default-extension';
import '@codingame/monaco-vscode-xml-default-extension';
import '@codingame/monaco-vscode-ini-default-extension';
import '@codingame/monaco-vscode-rust-default-extension';
import '@codingame/monaco-vscode-go-default-extension';
import '@codingame/monaco-vscode-docker-default-extension';

export type MonacoApi = typeof monaco;

/**
 * Boots the VS Code services Monaco runs on. Must happen exactly once, before any editor is
 * created; callers go through `loadMonaco()` which caches the promise.
 */
export async function setupMonaco(userConfiguration: string): Promise<MonacoApi> {
	(globalThis as { MonacoEnvironment?: unknown }).MonacoEnvironment = {
		getWorker: (_moduleId: string, label: string): Worker =>
			label === 'TextMateWorker' ? new TextMateWorker() : new EditorWorker(),
	};
	await initialize({
		...getConfigurationServiceOverride(),
		...getThemeServiceOverride(),
		...getTextmateServiceOverride(),
		...getLanguagesServiceOverride(),
	});
	await updateUserConfiguration(userConfiguration);
	return monaco;
}

export async function applyUserConfiguration(userConfiguration: string): Promise<void> {
	await updateUserConfiguration(userConfiguration);
}
