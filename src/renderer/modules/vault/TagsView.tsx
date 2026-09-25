import { ArrowLeft, FileText, Hash } from 'lucide-react';
import type { JSX } from 'react';

import type { NoteMeta } from '@shared/ipc/channels/vault';

import { IconButton } from '../../ui/IconButton';
import { openNote, useTags, useVaultUi } from './use-vault';

export function TagsView({ notes }: { notes: NoteMeta[] }): JSX.Element {
	const tags = useTags(true);
	const tag = useVaultUi((s) => s.tag);
	const showTag = useVaultUi((s) => s.showTag);

	if (tag) {
		const wanted = tag.toLowerCase();
		const tagged = notes.filter((n) => n.tags.some((t) => t.toLowerCase() === wanted));
		return (
			<div className='flex min-h-0 flex-1 flex-col'>
				<div className='flex items-center gap-1 border-b border-border px-2 py-1'>
					<IconButton
						label='All tags'
						size='sm'
						icon={<ArrowLeft size={12} />}
						onClick={() => useVaultUi.setState({ tag: null })}
					/>
					<span className='text-13 font-medium text-accent'>#{tag}</span>
					<span className='num ml-auto text-11 text-fg-2'>{tagged.length}</span>
				</div>
				<ul className='min-h-0 flex-1 overflow-y-auto' aria-label={`Notes tagged ${tag}`}>
					{tagged.map((n) => (
						<li key={n.path}>
							<button
								type='button'
								onClick={() => openNote(n.path)}
								className='flex h-6 w-full items-center gap-1.5 px-3 text-left text-13 text-fg-1 hover:bg-bg-2 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
							>
								<FileText size={13} className='shrink-0 text-fg-2' />
								<span className='truncate'>{n.title}</span>
								<span className='ml-auto truncate text-11 text-fg-2'>
									{n.path.includes('/')
										? n.path.slice(0, n.path.lastIndexOf('/'))
										: ''}
								</span>
							</button>
						</li>
					))}
				</ul>
			</div>
		);
	}

	if (tags.length === 0) {
		return <p className='p-3 text-12 text-fg-2'>No #tags in this vault yet.</p>;
	}
	return (
		<ul className='min-h-0 flex-1 overflow-y-auto py-1' aria-label='Tags'>
			{tags.map(({ tag: name, count }) => (
				<li key={name}>
					<button
						type='button'
						onClick={() => showTag(name)}
						className='flex h-6 w-full items-center gap-1.5 px-3 text-left text-13 text-fg-1 hover:bg-bg-2 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
						data-tag-row={name}
					>
						<Hash size={12} className='shrink-0 text-fg-2' />
						<span className='truncate'>{name}</span>
						<span className='num ml-auto text-11 text-fg-2'>{count}</span>
					</button>
				</li>
			))}
		</ul>
	);
}
