import { FileCode2, FileWarning } from 'lucide-react';
import type * as Monaco from 'monaco-editor';
import { type JSX, useEffect, useRef, useState } from 'react';

import { useGeneralSettings } from '../../app/hooks/use-general-settings';
import { useWorkspace } from '../../app/hooks/use-workspace';
import { rlog } from '../../lib/log';
import { loadMonaco } from '../../lib/monaco/load';
import type { MonacoApi } from '../../lib/monaco/setup';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Kbd } from '../../ui/Kbd';
import { Spinner } from '../../ui/Spinner';
import { useEditorStore } from './editor-store';
import { EditorDialogs } from './EditorDialogs';
import { EditorTabs } from './EditorTabs';
import { getModel, getViewState, requestClose, saveViewState } from './file-ops';

type LoadState =
	| { status: 'loading' }
	| { status: 'ready'; monaco: MonacoApi }
	| { status: 'error'; message: string };

export function EditorPanel(): JSX.Element {
	const files = useEditorStore((s) => s.files);
	const active = useEditorStore((s) => s.active);
	const setActive = useEditorStore((s) => s.setActive);
	const { info } = useWorkspace();
	const { settings } = useGeneralSettings();
	const hostRef = useRef<HTMLDivElement>(null);
	const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
	const [load, setLoad] = useState<LoadState>({ status: 'loading' });
	const [attempt, setAttempt] = useState(0);

	const activeFile = files.find((f) => f.path === active) ?? null;

	// Boot Monaco only once a file is open: it's ~10 MB of JS plus TextMate WASM, and loading it
	// at startup would compete with every other panel's first render.
	const needsMonaco = files.length > 0;
	useEffect(() => {
		if (!needsMonaco) return;
		let cancelled = false;
		loadMonaco(settings.fontSize, settings.reduceMotion)
			.then((monaco) => !cancelled && setLoad({ status: 'ready', monaco }))
			.catch((error: unknown) => {
				rlog.error('editor', 'monaco failed to load', error);
				if (!cancelled)
					setLoad({
						status: 'error',
						message: error instanceof Error ? error.message : String(error),
					});
			});
		return () => {
			cancelled = true;
		};
		// Settings changes are applied through refreshEditorConfiguration, not a reload.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [attempt, needsMonaco]);

	// One editor instance per panel; tabs swap models into it.
	useEffect(() => {
		if (load.status !== 'ready' || !hostRef.current) return;
		const { monaco } = load;
		const editor = monaco.editor.create(hostRef.current, {
			model: null,
			automaticLayout: true,
		});
		editorRef.current = editor;
		const updateCursor = (): void => {
			const model = editor.getModel();
			const pos = editor.getPosition();
			useEditorStore.getState().setCursor(
				model && pos
					? {
							line: pos.lineNumber,
							column: pos.column,
							language: model.getLanguageId(),
							eol: model.getEOL() === '\r\n' ? 'CRLF' : 'LF',
						}
					: null,
			);
		};
		const subs = [
			editor.onDidChangeCursorPosition(updateCursor),
			editor.onDidChangeModel(updateCursor),
			editor.onDidChangeModelLanguage(updateCursor),
		];
		return () => {
			for (const s of subs) s.dispose();
			editor.dispose();
			editorRef.current = null;
			useEditorStore.getState().setCursor(null);
		};
	}, [load]);

	// Show the active file's model, remembering scroll/cursor per file.
	const shownPath = useRef<string | null>(null);
	const activeReady = activeFile?.state === 'ready';
	useEffect(() => {
		const editor = editorRef.current;
		if (!editor) return;
		if (shownPath.current) saveViewState(shownPath.current, editor.saveViewState());
		const model = active && activeReady ? getModel(active) : null;
		editor.setModel(model);
		shownPath.current = model ? active : null;
		if (model && active) {
			const view = getViewState(active);
			if (view) editor.restoreViewState(view);
			editor.focus();
		}
	}, [active, activeReady, load]);

	// Go-to-line requests (search results, diagnostics) for the file on screen.
	const reveal = useEditorStore((s) => s.reveal);
	useEffect(() => {
		const editor = editorRef.current;
		if (!editor || !reveal || reveal.path !== active || !activeReady) return;
		if (shownPath.current !== active) return;
		editor.setPosition({ lineNumber: reveal.line, column: reveal.column });
		editor.revealLineInCenter(reveal.line);
		editor.focus();
		useEditorStore.getState().setReveal(null);
	}, [reveal, active, activeReady, load]);

	if (load.status === 'error') {
		return (
			<ErrorState
				title='The editor failed to load'
				message={load.message}
				onRetry={() => {
					setLoad({ status: 'loading' });
					setAttempt((n) => n + 1);
				}}
			/>
		);
	}

	const showEditor = load.status === 'ready' && activeFile?.state === 'ready';
	const booting = needsMonaco && load.status === 'loading';
	return (
		<div className='flex h-full flex-col bg-bg-1'>
			{files.length > 0 && (
				<EditorTabs
					files={files}
					active={active}
					onSelect={setActive}
					onClose={requestClose}
				/>
			)}
			<div className='relative min-h-0 flex-1'>
				<div
					ref={hostRef}
					className={showEditor ? 'absolute inset-0' : 'hidden'}
					data-editor-host
				/>
				{!showEditor && (
					<div className='absolute inset-0'>
						{booting || activeFile?.state === 'loading' ? (
							<div className='flex h-full items-center justify-center'>
								<Spinner label='Loading editor' />
							</div>
						) : activeFile?.state === 'error' ? (
							<ErrorState
								title={`Couldn't open ${activeFile.name}`}
								message={activeFile.error ?? 'Unknown error'}
							/>
						) : activeFile?.state === 'binary' || activeFile?.state === 'tooLarge' ? (
							<EmptyState
								icon={<FileWarning size={22} />}
								title={
									activeFile.state === 'binary' ? 'Binary file' : 'File too large'
								}
								description={
									activeFile.state === 'binary'
										? `${activeFile.name} isn't text, so it isn't shown here.`
										: `${activeFile.name} is over 5 MB. Open it in another program.`
								}
							/>
						) : (
							<EmptyState
								icon={<FileCode2 size={22} />}
								title={info.root ? 'No file open' : 'No folder open'}
								description={
									<span className='inline-flex items-center gap-1'>
										{info.root
											? 'Pick a file in the Explorer.'
											: 'Open a folder with'}
										{!info.root && <Kbd keys='Ctrl+O' />}
									</span>
								}
							/>
						)}
					</div>
				)}
			</div>
			<EditorDialogs />
		</div>
	);
}
