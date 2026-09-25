import { Circle, X } from 'lucide-react';
import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import type { OpenFile } from './editor-store';

interface EditorTabsProps {
	files: OpenFile[];
	active: string | null;
	onSelect: (path: string) => void;
	onClose: (path: string) => void;
}

export function EditorTabs({ files, active, onSelect, onClose }: EditorTabsProps): JSX.Element {
	return (
		<div
			role='tablist'
			aria-label='Open files'
			className='flex h-8 shrink-0 overflow-x-auto border-b border-border bg-bg-0'
		>
			{files.map((file) => {
				const isActive = file.path === active;
				return (
					<div
						key={file.path}
						role='tab'
						aria-selected={isActive}
						tabIndex={isActive ? 0 : -1}
						title={file.path}
						onClick={() => onSelect(file.path)}
						onAuxClick={(e) => {
							// Middle-click closes, like every browser and editor.
							if (e.button === 1) onClose(file.path);
						}}
						onKeyDown={(e) => {
							if (e.key === 'Enter' || e.key === ' ') onSelect(file.path);
						}}
						className={cn(
							'group relative flex max-w-56 shrink-0 cursor-default items-center gap-1.5 border-r border-border pr-1 pl-3 text-12 outline-none',
							isActive
								? 'bg-bg-1 text-fg-0'
								: 'text-fg-2 hover:bg-bg-1 hover:text-fg-1',
							'focus-visible:shadow-[inset_0_0_0_1px_var(--accent)]',
						)}
					>
						{isActive && <span className='absolute inset-x-0 top-0 h-px bg-accent' />}
						<span className={cn('truncate', file.changedOnDisk && 'text-warn')}>
							{file.name}
						</span>
						<button
							type='button'
							aria-label={
								file.dirty ? `Close ${file.name} (unsaved)` : `Close ${file.name}`
							}
							onClick={(e) => {
								e.stopPropagation();
								onClose(file.path);
							}}
							className='flex size-5 items-center justify-center rounded-sm text-fg-2 hover:bg-bg-3 hover:text-fg-0'
						>
							{file.dirty ? (
								<>
									<Circle size={8} className='fill-current group-hover:hidden' />
									<X size={12} className='hidden group-hover:block' />
								</>
							) : (
								<X
									size={12}
									className={isActive ? '' : 'invisible group-hover:visible'}
								/>
							)}
						</button>
					</div>
				);
			})}
		</div>
	);
}
