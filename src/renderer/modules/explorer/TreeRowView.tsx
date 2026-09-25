import {
	ChevronRight,
	File,
	FileCode2,
	FileJson,
	FileText,
	Folder,
	FolderOpen,
	Link2,
} from 'lucide-react';
import type { JSX } from 'react';

import type { FsEntry } from '@shared/ipc/channels/fs';

import { cn } from '../../lib/cn';

const IGNORED = new Set(['node_modules', '.git', '.venv', '__pycache__', 'out', 'dist']);

function FileIcon({ entry, open }: { entry: FsEntry; open: boolean }): JSX.Element {
	if (entry.kind === 'dir') return open ? <FolderOpen size={14} /> : <Folder size={14} />;
	if (entry.kind === 'symlink') return <Link2 size={14} />;
	const ext = entry.name.slice(entry.name.lastIndexOf('.') + 1).toLowerCase();
	if (['ts', 'tsx', 'js', 'jsx', 'py', 'mjs', 'cjs', 'css', 'html', 'rs', 'go'].includes(ext)) {
		return <FileCode2 size={14} />;
	}
	if (['json', 'toml', 'yaml', 'yml', 'lock'].includes(ext)) return <FileJson size={14} />;
	if (['md', 'txt', 'rst'].includes(ext)) return <FileText size={14} />;
	return <File size={14} />;
}

interface TreeRowViewProps {
	entry: FsEntry;
	depth: number;
	expanded: boolean;
	focused: boolean;
	active: boolean;
	onClick: () => void;
	onDoubleClick: () => void;
	onContextMenu: () => void;
}

export function TreeRowView({
	entry,
	depth,
	expanded,
	focused,
	active,
	onClick,
	onDoubleClick,
	onContextMenu,
}: TreeRowViewProps): JSX.Element {
	const isDir = entry.kind === 'dir';
	return (
		<div
			role='treeitem'
			aria-level={depth + 1}
			aria-expanded={isDir ? expanded : undefined}
			aria-selected={focused}
			data-path={entry.path}
			onClick={onClick}
			onDoubleClick={onDoubleClick}
			onContextMenu={onContextMenu}
			title={entry.path}
			className={cn(
				'flex h-6 cursor-default items-center gap-1 pr-2 text-12 select-none',
				focused ? 'bg-bg-3 text-fg-0' : 'text-fg-1 hover:bg-bg-2',
				active && 'text-accent',
				IGNORED.has(entry.name) && 'opacity-50',
			)}
			style={{ paddingLeft: 8 + depth * 12 }}
		>
			<ChevronRight
				size={12}
				className={cn(
					'shrink-0 text-fg-2 transition-transform transition-fast',
					!isDir && 'invisible',
					expanded && 'rotate-90',
				)}
			/>
			<span className={cn('shrink-0', isDir ? 'text-accent/80' : 'text-fg-2')}>
				<FileIcon entry={entry} open={expanded} />
			</span>
			<span className='truncate'>{entry.name}</span>
		</div>
	);
}
