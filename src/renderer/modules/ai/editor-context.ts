import type * as Monaco from 'monaco-editor';

import type { AiContext } from '@shared/ipc/channels/ai';

import { getLoadedMonaco } from '../../lib/monaco/load';
import { toWorkspacePath } from '../../lib/monaco/workspace-root';
import { useWorkbenchStore } from '../../stores/workbench-store';

export interface ActiveEditor {
	path: string;
	language: string;
	model: Monaco.editor.ITextModel;
	/** 1-based inclusive lines, or null when nothing is selected. */
	selection: { startLine: number; endLine: number; text: string } | null;
}

/**
 * The file shown in Forge's editor (and its selection), read through Monaco's global registry so
 * this module needn't import the editor module.
 */
export function activeEditor(): ActiveEditor | null {
	const monaco = getLoadedMonaco();
	const activeFile = useWorkbenchStore.getState().activeFile;
	if (!monaco || !activeFile) return null;
	for (const editor of monaco.editor.getEditors()) {
		const model = editor.getModel();
		if (!model || !('getLanguageId' in model)) continue;
		const path = toWorkspacePath(model.uri);
		if (path !== activeFile) continue;
		const sel = editor.getSelection();
		const selection =
			sel && !sel.isEmpty()
				? {
						startLine: sel.startLineNumber,
						// A selection ending at column 1 doesn't really include that line.
						endLine:
							sel.endColumn === 1 && sel.endLineNumber > sel.startLineNumber
								? sel.endLineNumber - 1
								: sel.endLineNumber,
						text: model.getValueInRange(sel),
					}
				: null;
		return {
			path,
			language: model.getLanguageId(),
			model: model as Monaco.editor.ITextModel,
			selection,
		};
	}
	return null;
}

const MAX_FILE = 200_000;

export function fileContext(editor: ActiveEditor): AiContext {
	const text = editor.model.getValue();
	return {
		kind: 'file',
		label: editor.path,
		language: editor.language,
		text: text.length > MAX_FILE ? `${text.slice(0, MAX_FILE)}\n… (truncated)` : text,
	};
}

export function selectionContext(editor: ActiveEditor): AiContext | null {
	if (!editor.selection) return null;
	return {
		kind: 'selection',
		label: `${editor.path}:${editor.selection.startLine}-${editor.selection.endLine}`,
		language: editor.language,
		text: editor.selection.text,
	};
}
