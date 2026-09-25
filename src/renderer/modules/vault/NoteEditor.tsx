import type * as Monaco from 'monaco-editor';
import { type JSX, useEffect, useRef, useState } from 'react';

import { useGeneralSettings } from '../../app/hooks/use-general-settings';
import { rlog } from '../../lib/log';
import { loadMonaco } from '../../lib/monaco/load';
import type { MonacoApi } from '../../lib/monaco/setup';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';

interface NoteEditorProps {
	path: string;
	content: string;
	/** Changes only when the text is replaced from disk (not on our own keystrokes). */
	revision: number;
	onChange: (text: string) => void;
	onSave: () => void;
	onTogglePreview: () => void;
}

/** Monaco in "writing" mode: Markdown, word wrap, no gutter or minimap. */
export function NoteEditor({
	path,
	content,
	revision,
	onChange,
	onSave,
	onTogglePreview,
}: NoteEditorProps): JSX.Element {
	const { settings } = useGeneralSettings();
	const hostRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
	const [monaco, setMonaco] = useState<MonacoApi | null>(null);
	const [error, setError] = useState<string | null>(null);
	// Handlers change every render; the editor's listeners read them through a ref.
	const handlers = useRef({ onChange, onSave, onTogglePreview });
	useEffect(() => {
		handlers.current = { onChange, onSave, onTogglePreview };
	});

	useEffect(() => {
		let cancelled = false;
		loadMonaco(settings.fontSize, settings.reduceMotion)
			.then((api) => !cancelled && setMonaco(api))
			.catch((e: unknown) => {
				rlog.error('vault', 'monaco failed to load', e);
				if (!cancelled) setError(e instanceof Error ? e.message : String(e));
			});
		return () => {
			cancelled = true;
		};
		// Font/motion changes are applied by the editor module's configuration refresh.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!monaco || !hostRef.current) return;
		const uri = monaco.Uri.from({ scheme: 'forge-vault', path: `/${path}` });
		const model =
			monaco.editor.getModel(uri) ?? monaco.editor.createModel(content, 'markdown', uri);
		const editor = monaco.editor.create(hostRef.current, {
			model,
			automaticLayout: true,
			wordWrap: 'on',
			lineNumbers: 'off',
			minimap: { enabled: false },
			glyphMargin: false,
			folding: false,
			renderLineHighlight: 'none',
			padding: { top: 12, bottom: 12 },
			scrollBeyondLastLine: false,
			unicodeHighlight: { ambiguousCharacters: false },
		});
		editorRef.current = editor;
		const sub = model.onDidChangeContent(() => handlers.current.onChange(model.getValue()));
		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () =>
			handlers.current.onSave(),
		);
		editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyE, () =>
			handlers.current.onTogglePreview(),
		);
		editor.focus();
		return () => {
			sub.dispose();
			editor.dispose();
			model.dispose();
			editorRef.current = null;
		};
		// The model is created once per mount; later text arrives through `revision`.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [monaco, path]);

	// Text replaced from disk: push it as an edit so undo history and cursor survive.
	useEffect(() => {
		const model = editorRef.current?.getModel();
		if (!model || model.getValue() === content) return;
		model.pushEditOperations(
			[],
			[{ range: model.getFullModelRange(), text: content }],
			() => null,
		);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [revision]);

	if (error) return <ErrorState title='Editor failed to load' message={error} />;
	return (
		<div className='relative min-h-0 flex-1'>
			{!monaco && (
				<div className='absolute inset-0 flex items-center justify-center'>
					<Spinner label='Loading editor' />
				</div>
			)}
			<div ref={hostRef} className='absolute inset-0' data-note-editor={path} />
		</div>
	);
}
