import type * as Monaco from 'monaco-editor';

import { call, IpcCallError } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import type { MonacoApi } from '../../lib/monaco/setup';
import { toast } from '../../stores/toast-store';
import { useEditorStore } from './editor-store';

interface Tracked {
	model: Monaco.editor.ITextModel;
	/** Alternative version id at last load/save; differs from the current one when dirty. */
	savedVersion: number;
	listener: Monaco.IDisposable;
	viewState: Monaco.editor.ICodeEditorViewState | null;
}

const tracked = new Map<string, Tracked>();

export function getModel(path: string): Monaco.editor.ITextModel | null {
	return tracked.get(path)?.model ?? null;
}

export function saveViewState(
	path: string,
	state: Monaco.editor.ICodeEditorViewState | null,
): void {
	const t = tracked.get(path);
	if (t) t.viewState = state;
}

export function getViewState(path: string): Monaco.editor.ICodeEditorViewState | null {
	return tracked.get(path)?.viewState ?? null;
}

function toUri(monaco: MonacoApi, root: string, path: string): Monaco.Uri {
	// Absolute file:// URIs are what language servers (Phase 2) expect.
	return monaco.Uri.file(`${root.replace(/\\/g, '/')}/${path}`);
}

function markDirty(path: string): void {
	const t = tracked.get(path);
	if (!t) return;
	useEditorStore
		.getState()
		.update(path, { dirty: t.model.getAlternativeVersionId() !== t.savedVersion });
}

export async function openFile(monaco: MonacoApi, root: string, path: string): Promise<void> {
	const store = useEditorStore.getState();
	if (store.files.some((f) => f.path === path)) {
		store.setActive(path);
		return;
	}
	store.add({
		path,
		name: path.split('/').at(-1) ?? path,
		state: 'loading',
		dirty: false,
		mtimeMs: 0,
		changedOnDisk: false,
	});
	try {
		const file = await call('fs:readFile', path);
		if (file.binary || file.tooLarge) {
			store.update(path, {
				state: file.binary ? 'binary' : 'tooLarge',
				mtimeMs: file.mtimeMs,
			});
			return;
		}
		const model = monaco.editor.createModel(file.content, undefined, toUri(monaco, root, path));
		model.setEOL(
			file.eol === '\r\n'
				? monaco.editor.EndOfLineSequence.CRLF
				: monaco.editor.EndOfLineSequence.LF,
		);
		const t: Tracked = {
			model,
			savedVersion: model.getAlternativeVersionId(),
			listener: model.onDidChangeContent(() => markDirty(path)),
			viewState: null,
		};
		tracked.set(path, t);
		store.update(path, { state: 'ready', mtimeMs: file.mtimeMs });
	} catch (error) {
		rlog.warn('editor', `open failed: ${path}`, error);
		store.update(path, {
			state: 'error',
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/** Saves one file. With `force`, overwrites even if it changed on disk. */
export async function saveFile(path: string, force = false): Promise<boolean> {
	const store = useEditorStore.getState();
	const t = tracked.get(path);
	const file = store.files.find((f) => f.path === path);
	if (!t || !file) return false;
	try {
		const version = t.model.getAlternativeVersionId();
		const { mtimeMs } = await call('fs:writeFile', {
			path,
			content: t.model.getValue(),
			...(force ? {} : { expectedMtimeMs: file.mtimeMs }),
		});
		t.savedVersion = version;
		store.update(path, { mtimeMs, changedOnDisk: false });
		markDirty(path);
		return true;
	} catch (error) {
		if (error instanceof IpcCallError && error.code === 'FS_CONFLICT') {
			store.setConflict(path);
			return false;
		}
		rlog.error('editor', `save failed: ${path}`, error);
		toast.error(
			`Could not save ${file.name}`,
			error instanceof Error ? error.message : undefined,
		);
		return false;
	}
}

export async function saveAll(): Promise<void> {
	for (const f of useEditorStore.getState().files) if (f.dirty) await saveFile(f.path);
}

/** Replaces the buffer with the disk version (used for external changes and "Reload"). */
export async function reloadFromDisk(path: string): Promise<void> {
	const t = tracked.get(path);
	if (!t) return;
	try {
		const file = await call('fs:readFile', path);
		if (file.binary || file.tooLarge) return;
		if (file.content !== t.model.getValue()) {
			// pushEditOperations keeps the reload undoable, unlike setValue.
			t.model.pushEditOperations(
				[],
				[{ range: t.model.getFullModelRange(), text: file.content }],
				() => null,
			);
		}
		t.savedVersion = t.model.getAlternativeVersionId();
		useEditorStore.getState().update(path, { mtimeMs: file.mtimeMs, changedOnDisk: false });
		markDirty(path);
	} catch (error) {
		// The file was deleted or became unreadable; keep the buffer so nothing is lost.
		rlog.warn('editor', `reload failed: ${path}`, error);
		useEditorStore.getState().update(path, { changedOnDisk: true });
	}
}

/** Called for files the watcher reports as changed. Clean buffers follow disk; dirty ones get flagged. */
export function onExternalChange(paths: readonly string[]): void {
	const store = useEditorStore.getState();
	for (const path of paths) {
		const file = store.files.find((f) => f.path === path);
		if (!file || file.state !== 'ready') continue;
		if (file.dirty) store.update(path, { changedOnDisk: true });
		else void reloadFromDisk(path);
	}
}

export function closeFile(path: string): void {
	const t = tracked.get(path);
	if (t) {
		t.listener.dispose();
		t.model.dispose();
		tracked.delete(path);
	}
	useEditorStore.getState().remove(path);
}

/** Closes a tab, asking first if it has unsaved changes. */
export function requestClose(path: string): void {
	const file = useEditorStore.getState().files.find((f) => f.path === path);
	if (file?.dirty) useEditorStore.getState().setClosing(path);
	else closeFile(path);
}

export function closeAll(): void {
	for (const f of [...useEditorStore.getState().files]) closeFile(f.path);
}
