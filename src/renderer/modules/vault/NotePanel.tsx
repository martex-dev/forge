import { BookOpen, Eye, FileText, PenLine } from 'lucide-react';
import { type JSX, useEffect } from 'react';

import { cn } from '../../lib/cn';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { NoteEditor } from './NoteEditor';
import { NotePreview } from './NotePreview';
import { type SaveState, useNote } from './use-note';
import { useVaultEvents, useVaultUi } from './use-vault';

const SAVE_LABEL: Record<SaveState, string> = {
	saved: 'Saved',
	dirty: 'Unsaved',
	saving: 'Saving…',
	conflict: 'Changed on disk',
	error: 'Save failed',
};

type Mode = 'edit' | 'preview';

function NoteView({
	path,
	mode,
	setMode,
}: {
	path: string;
	mode: Mode;
	setMode: (mode: Mode) => void;
}): JSX.Element {
	const doc = useNote(path);
	const toggle = (): void => setMode(mode === 'edit' ? 'preview' : 'edit');
	const folder = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';

	if (doc.load.status === 'loading') {
		return (
			<div className='flex h-full items-center justify-center'>
				<Spinner label='Opening note' />
			</div>
		);
	}
	if (doc.load.status === 'error') {
		return <ErrorState title='Could not open note' message={doc.load.message} />;
	}
	return (
		<div
			className='flex h-full flex-col'
			onKeyDown={(e) => {
				// Monaco handles these itself while it has focus; this covers the preview.
				if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
					e.preventDefault();
					toggle();
				}
			}}
		>
			<header className='flex items-center gap-2 border-b border-border px-3 py-1'>
				<FileText size={13} className='text-fg-2' />
				<span className='truncate text-12 text-fg-2' title={path}>
					{folder && `${folder} / `}
				</span>
				<span
					className={cn(
						'num text-11',
						doc.save === 'saved'
							? 'text-fg-2'
							: doc.save === 'dirty' || doc.save === 'saving'
								? 'text-fg-1'
								: 'text-down',
					)}
					title={doc.saveError ?? undefined}
					data-save-state={doc.save}
				>
					{SAVE_LABEL[doc.save]}
				</span>
				<div className='ml-auto flex gap-1'>
					<Button
						size='sm'
						variant={mode === 'edit' ? 'secondary' : 'ghost'}
						icon={<PenLine size={12} />}
						onClick={() => setMode('edit')}
						aria-pressed={mode === 'edit'}
						title='Edit (Ctrl+E)'
					>
						Edit
					</Button>
					<Button
						size='sm'
						variant={mode === 'preview' ? 'secondary' : 'ghost'}
						icon={<Eye size={12} />}
						onClick={() => setMode('preview')}
						aria-pressed={mode === 'preview'}
						title='Preview (Ctrl+E)'
					>
						Preview
					</Button>
				</div>
			</header>
			{doc.save === 'conflict' && (
				<div
					role='alert'
					className='flex items-center gap-2 border-b border-warn/40 bg-warn-soft px-3 py-1.5 text-12 text-warn'
				>
					<span className='flex-1'>
						This note changed on disk (Obsidian or sync) while you had unsaved edits.
					</span>
					<Button size='sm' onClick={() => void doc.reloadFromDisk()}>
						Use disk version
					</Button>
					<Button size='sm' variant='danger' onClick={() => void doc.overwrite()}>
						Keep mine
					</Button>
				</div>
			)}
			{mode === 'edit' ? (
				<NoteEditor
					path={path}
					content={doc.content}
					revision={doc.revision}
					onChange={doc.edit}
					onSave={() => void doc.flush()}
					onTogglePreview={toggle}
				/>
			) : (
				<NotePreview path={path} content={doc.content} />
			)}
		</div>
	);
}

export function NotePanel({ params, setParams }: PanelProps): JSX.Element {
	useVaultEvents();
	const path = typeof params['path'] === 'string' ? params['path'] : null;
	const mode: Mode = params['mode'] === 'preview' ? 'preview' : 'edit';
	useEffect(() => {
		if (path) useVaultUi.getState().setActivePath(path);
	}, [path]);

	if (!path) {
		return (
			<EmptyState
				icon={<BookOpen size={20} />}
				title='No note open'
				description='Pick a note in the Vault sidebar, or create one.'
				action={<Badge>Ctrl+Alt+N for a quick note</Badge>}
			/>
		);
	}
	return (
		<div className='h-full bg-bg-1'>
			<NoteView key={path} path={path} mode={mode} setMode={(m) => setParams({ mode: m })} />
		</div>
	);
}
