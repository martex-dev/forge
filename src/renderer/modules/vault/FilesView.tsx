import { ChevronDown, ChevronRight, FileText, Folder } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import type { NoteMeta } from '@shared/ipc/channels/vault';

import { cn } from '../../lib/cn';
import { ancestors, buildTree, visibleRows } from './note-tree';
import { openNote, useVaultUi } from './use-vault';

export function FilesView({ notes }: { notes: NoteMeta[] }): JSX.Element {
	const activePath = useVaultUi((s) => s.activePath);
	const tree = useMemo(() => buildTree(notes), [notes]);
	const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set());
	const [revealed, setRevealed] = useState<string | null>(null);
	// Reveal the open note's folders once per note (adjusting state during render, not in an effect).
	if (activePath && activePath !== revealed) {
		setRevealed(activePath);
		const missing = ancestors(activePath).filter((a) => !expanded.has(a));
		if (missing.length) setExpanded(new Set([...expanded, ...missing]));
	}
	const rows = useMemo(() => visibleRows(tree, expanded), [tree, expanded]);

	const toggle = (path: string): void => {
		const next = new Set(expanded);
		if (next.has(path)) next.delete(path);
		else next.add(path);
		setExpanded(next);
	};

	return (
		<ul className='min-h-0 flex-1 overflow-y-auto py-1' role='tree' aria-label='Vault notes'>
			{rows.map(({ node, depth }) => {
				const isFolder = node.kind === 'folder';
				const open = isFolder && expanded.has(node.path);
				const active = !isFolder && node.path === activePath;
				return (
					<li
						key={node.path}
						role='treeitem'
						aria-expanded={isFolder ? open : undefined}
						aria-selected={active}
					>
						<button
							type='button'
							onClick={() => (isFolder ? toggle(node.path) : openNote(node.path))}
							onKeyDown={(e) => {
								if (!isFolder) return;
								if (e.key === 'ArrowRight' && !open) toggle(node.path);
								if (e.key === 'ArrowLeft' && open) toggle(node.path);
							}}
							className={cn(
								'flex h-6 w-full items-center gap-1 pr-2 text-left text-13',
								'focus-visible:shadow-glow focus-visible:outline-none',
								active
									? 'bg-accent-soft text-fg-0'
									: 'text-fg-1 hover:bg-bg-2 hover:text-fg-0',
							)}
							style={{ paddingLeft: 8 + depth * 12 }}
							data-vault-path={node.path}
						>
							{isFolder ? (
								<>
									{open ? (
										<ChevronDown size={12} className='shrink-0 text-fg-2' />
									) : (
										<ChevronRight size={12} className='shrink-0 text-fg-2' />
									)}
									<Folder size={13} className='shrink-0 text-fg-2' />
								</>
							) : (
								<FileText size={13} className='ml-3 shrink-0 text-fg-2' />
							)}
							<span className='truncate'>{node.name}</span>
						</button>
					</li>
				);
			})}
		</ul>
	);
}
