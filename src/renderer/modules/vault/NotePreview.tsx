import { Link2 } from 'lucide-react';
import { type JSX, type MouseEvent, useMemo } from 'react';

import { call } from '../../lib/ipc';
import { renderMarkdown } from '../../lib/markdown/markdown';
import { toast } from '../../stores/toast-store';
import { followWikilink, openNote, useBacklinks, useVaultUi } from './use-vault';

import '../../lib/markdown/markdown.css';

function onLinkClick(e: MouseEvent<HTMLElement>, from: string): void {
	const anchor = (e.target as HTMLElement).closest('a');
	if (!anchor) return;
	// Never let a click navigate the app window.
	e.preventDefault();
	const wikilink = anchor.dataset['wikilink'];
	const tag = anchor.dataset['tag'];
	if (wikilink !== undefined) {
		if (/\.(?!md$)[a-z0-9]{1,5}$/i.test(wikilink)) {
			toast.info(
				'Attachment',
				`${wikilink} — open it in Obsidian (attachments aren't shown yet).`,
			);
			return;
		}
		void followWikilink(wikilink, from);
	} else if (tag !== undefined) {
		useVaultUi.getState().showTag(tag);
	} else if (anchor.href.startsWith('https://') || anchor.href.startsWith('http://')) {
		call('app:openExternal', anchor.href).catch(() => toast.error('Could not open link'));
	}
}

export function NotePreview({ path, content }: { path: string; content: string }): JSX.Element {
	// markdown-it runs with html:false and safe link validation, so this HTML carries no markup
	// from the note itself — see markdown.ts.
	const html = useMemo(() => renderMarkdown(content), [content]);
	const backlinks = useBacklinks(path);

	return (
		<div className='min-h-0 flex-1 overflow-y-auto' data-note-preview={path}>
			<article
				className='md-preview selectable mx-auto max-w-3xl px-6 py-4'
				onClick={(e) => onLinkClick(e, path)}
				dangerouslySetInnerHTML={{ __html: html }}
			/>
			<section
				className='mx-auto max-w-3xl border-t border-border px-6 py-3'
				aria-label='Backlinks'
			>
				<h3 className='mb-1 flex items-center gap-1 text-12 font-medium text-fg-2'>
					<Link2 size={12} /> Linked mentions ({backlinks.length})
				</h3>
				{backlinks.length === 0 ? (
					<p className='text-12 text-fg-2'>No other note links here yet.</p>
				) : (
					<ul className='flex flex-wrap gap-1'>
						{backlinks.map((n) => (
							<li key={n.path}>
								<button
									type='button'
									onClick={() => openNote(n.path)}
									className='rounded-sm border border-border px-1.5 py-0.5 text-12 text-fg-1 hover:border-accent/50 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
									title={n.path}
								>
									{n.title}
								</button>
							</li>
						))}
					</ul>
				)}
			</section>
		</div>
	);
}
