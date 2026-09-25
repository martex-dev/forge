import { useCallback, useEffect, useRef, useState } from 'react';

import { call, IpcCallError } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';

// Obsidian autosaves too; a short debounce keeps typing smooth and disk writes rare.
const AUTOSAVE_MS = 800;

export type SaveState = 'saved' | 'dirty' | 'saving' | 'conflict' | 'error';
export type LoadState =
	{ status: 'loading' } | { status: 'ready' } | { status: 'error'; message: string };

export interface NoteDoc {
	load: LoadState;
	/** Latest text: what the editor shows and the preview renders. */
	content: string;
	/** Bumped when the text is replaced from disk, so the editor swaps its model value. */
	revision: number;
	save: SaveState;
	saveError: string | null;
	edit: (text: string) => void;
	flush: () => Promise<void>;
	/** Conflict resolution: take the disk version, or overwrite it with ours. */
	reloadFromDisk: () => Promise<void>;
	overwrite: () => Promise<void>;
}

/** Load / autosave / external-change handling for one note. Mount per path (`key={path}`). */
export function useNote(path: string): NoteDoc {
	const [load, setLoad] = useState<LoadState>({ status: 'loading' });
	const [content, setContent] = useState('');
	const [revision, setRevision] = useState(0);
	const [save, setSave] = useState<SaveState>('saved');
	const [saveError, setSaveError] = useState<string | null>(null);
	const baseMtime = useRef<number | null>(null);
	const latest = useRef('');
	const dirty = useRef(false);
	const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	const replace = useCallback((text: string, mtime: number) => {
		latest.current = text;
		baseMtime.current = mtime;
		dirty.current = false;
		setContent(text);
		setRevision((r) => r + 1);
		setSave('saved');
		setSaveError(null);
	}, []);

	useEffect(() => {
		let cancelled = false;
		call('vault:read', path)
			.then(({ content: text, mtime }) => {
				if (cancelled) return;
				replace(text, mtime);
				setLoad({ status: 'ready' });
			})
			.catch((error: unknown) => {
				if (!cancelled)
					setLoad({
						status: 'error',
						message: error instanceof Error ? error.message : String(error),
					});
			});
		return () => {
			cancelled = true;
		};
	}, [path, replace]);

	const write = useCallback(
		async (force: boolean): Promise<void> => {
			clearTimeout(timer.current);
			const text = latest.current;
			setSave('saving');
			try {
				const { mtime } = await call('vault:write', {
					path,
					content: text,
					baseMtime: force ? null : baseMtime.current,
				});
				baseMtime.current = mtime;
				// Typing during the write keeps it dirty; the next autosave picks it up.
				dirty.current = latest.current !== text;
				setSave(dirty.current ? 'dirty' : 'saved');
				setSaveError(null);
			} catch (error) {
				const conflict = error instanceof IpcCallError && error.code === 'VAULT_CONFLICT';
				setSave(conflict ? 'conflict' : 'error');
				setSaveError(error instanceof Error ? error.message : String(error));
			}
		},
		[path],
	);

	const flush = useCallback(async () => {
		if (dirty.current) await write(false);
	}, [write]);

	const edit = useCallback(
		(text: string) => {
			if (text === latest.current) return;
			latest.current = text;
			dirty.current = true;
			setContent(text);
			setSave((s) => (s === 'conflict' ? s : 'dirty'));
			clearTimeout(timer.current);
			timer.current = setTimeout(() => void flush(), AUTOSAVE_MS);
		},
		[flush],
	);

	const reloadFromDisk = useCallback(async () => {
		const { content: text, mtime } = await call('vault:read', path);
		replace(text, mtime);
	}, [path, replace]);

	// Changed on disk by Obsidian or sync: follow it silently unless we have unsaved edits.
	useForgeEvent('vault:changed', ({ paths, full }) => {
		if (!full && !paths.includes(path)) return;
		void call('vault:read', path)
			.then(({ content: text, mtime }) => {
				if (baseMtime.current !== null && Math.abs(mtime - baseMtime.current) <= 1) return;
				if (dirty.current) setSave('conflict');
				else if (text !== latest.current) replace(text, mtime);
				else baseMtime.current = mtime;
			})
			.catch(() => undefined); // Deleted or renamed: the panel keeps the last text.
	});

	// Don't lose the last keystrokes when the panel closes.
	useEffect(
		() => () => {
			if (dirty.current) void write(false);
		},
		[write],
	);

	return {
		load,
		content,
		revision,
		save,
		saveError,
		edit,
		flush,
		reloadFromDisk,
		overwrite: () => write(true),
	};
}
