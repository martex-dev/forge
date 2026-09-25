import { BookOpen, FilePlus2, FolderOpen, NotebookPen } from 'lucide-react';
import type { JSX, ReactNode } from 'react';

import { cn } from '../../lib/cn';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { FilesView } from './FilesView';
import { useNewNote } from './NewNoteDialog';
import { useQuickNote } from './QuickNoteDialog';
import { SearchView } from './SearchView';
import { TagsView } from './TagsView';
import { useNotes, useVaultActions, useVaultEvents, useVaultInfo, useVaultUi } from './use-vault';

function ViewTab({
	active,
	onClick,
	children,
}: {
	active: boolean;
	onClick: () => void;
	children: ReactNode;
}): JSX.Element {
	return (
		<button
			type='button'
			role='tab'
			aria-selected={active}
			onClick={onClick}
			className={cn(
				'h-7 flex-1 border-b-2 text-12 transition-colors transition-fast',
				'focus-visible:shadow-glow focus-visible:outline-none',
				active ? 'border-accent text-fg-0' : 'border-transparent text-fg-2 hover:text-fg-1',
			)}
		>
			{children}
		</button>
	);
}

export function VaultPanel(): JSX.Element {
	useVaultEvents();
	const { info, isLoading, error } = useVaultInfo();
	const { choose } = useVaultActions();
	const view = useVaultUi((s) => s.view);
	const setView = useVaultUi((s) => s.setView);
	const hasVault = Boolean(info?.root);
	const notes = useNotes(hasVault);

	if (isLoading) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Loading vault' />
			</div>
		);
	}
	if (error) return <ErrorState title='Vault unavailable' message={error.message} />;
	if (!info?.root) {
		return (
			<EmptyState
				icon={<BookOpen size={20} />}
				title='Open your Obsidian vault'
				description='Pick the vault folder. Notes stay plain Markdown files; Obsidian keeps working alongside.'
				action={
					<Button variant='primary' icon={<FolderOpen size={14} />} onClick={choose}>
						Choose vault folder
					</Button>
				}
			/>
		);
	}

	return (
		<div className='flex h-full flex-col bg-bg-1' data-vault={info.name ?? ''}>
			<header className='flex items-center gap-1 border-b border-border py-1 pr-1 pl-3'>
				<div className='min-w-0 flex-1'>
					<div className='truncate text-13 font-medium text-fg-0' title={info.root}>
						{info.name}
					</div>
					<div className='num text-11 text-fg-2'>
						{info.noteCount} notes{info.isObsidian ? '' : ' · not an Obsidian vault'}
					</div>
				</div>
				<IconButton
					label='New note'
					icon={<FilePlus2 size={14} />}
					onClick={() => useNewNote.getState().open()}
				/>
				<IconButton
					label='Quick note'
					shortcut='Ctrl+Alt+N'
					icon={<NotebookPen size={14} />}
					onClick={() => useQuickNote.getState().setOpen(true)}
				/>
				<IconButton
					label='Change vault…'
					icon={<FolderOpen size={14} />}
					onClick={choose}
				/>
			</header>
			<div role='tablist' aria-label='Vault views' className='flex border-b border-border'>
				<ViewTab active={view === 'files'} onClick={() => setView('files')}>
					Files
				</ViewTab>
				<ViewTab active={view === 'search'} onClick={() => setView('search')}>
					Search
				</ViewTab>
				<ViewTab active={view === 'tags'} onClick={() => setView('tags')}>
					Tags
				</ViewTab>
			</div>
			{notes.error ? (
				<ErrorState title='Could not list notes' message={notes.error.message} />
			) : notes.isLoading ? (
				<div className='flex flex-1 items-center justify-center'>
					<Spinner label='Indexing notes' />
				</div>
			) : view === 'files' ? (
				notes.notes.length === 0 ? (
					<p className='p-3 text-12 text-fg-2'>No Markdown notes in this folder yet.</p>
				) : (
					<FilesView notes={notes.notes} />
				)
			) : view === 'search' ? (
				<SearchView />
			) : (
				<TagsView notes={notes.notes} />
			)}
		</div>
	);
}
