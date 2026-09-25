import { type JSX, type MouseEvent, useMemo, useState } from 'react';

import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { renderMarkdown } from '../../lib/markdown/markdown';
import { toast } from '../../stores/toast-store';

import '../../lib/markdown/markdown.css';

/** Links in the preview open in the system browser, never in the app window. */
function onPreviewClick(e: MouseEvent<HTMLElement>): void {
	const anchor = (e.target as HTMLElement).closest('a');
	if (!anchor) return;
	e.preventDefault();
	if (anchor.href.startsWith('https://') || anchor.href.startsWith('http://')) {
		call('app:openExternal', anchor.href).catch(() => toast.error('Could not open link'));
	}
}

/** Markdown notes with a Write / Preview toggle. */
export function NotesField({
	value,
	onChange,
}: {
	value: string;
	onChange: (value: string) => void;
}): JSX.Element {
	const [preview, setPreview] = useState(false);
	const notesHtml = useMemo(() => (preview ? renderMarkdown(value) : ''), [preview, value]);
	return (
		<section className='flex flex-col gap-1.5'>
			<div className='flex items-center gap-2'>
				<h3 className='text-12 font-medium text-fg-1'>Notes</h3>
				<div className='ml-auto flex gap-1' role='group' aria-label='Notes view'>
					{(['Write', 'Preview'] as const).map((v) => (
						<button
							key={v}
							type='button'
							aria-pressed={preview === (v === 'Preview')}
							onClick={() => setPreview(v === 'Preview')}
							className={cn(
								'h-5 rounded-sm px-1.5 text-11 focus-visible:shadow-glow focus-visible:outline-none',
								preview === (v === 'Preview')
									? 'bg-bg-3 text-fg-0'
									: 'text-fg-2 hover:text-fg-1',
							)}
						>
							{v}
						</button>
					))}
				</div>
			</div>
			{preview ? (
				// html:false in markdown-it: the notes can't inject markup.
				<div
					className='md-preview min-h-24 rounded-sm border border-border bg-bg-2 px-3 py-2 text-13'
					dangerouslySetInnerHTML={{ __html: notesHtml || '<p>Nothing yet.</p>' }}
					onClick={onPreviewClick}
				/>
			) : (
				<textarea
					value={value}
					onChange={(e) => onChange(e.target.value)}
					rows={8}
					spellCheck
					aria-label='Notes'
					placeholder='Thesis, execution, emotions, what to repeat or avoid… (Markdown)'
					className='selectable w-full resize-y rounded-sm border border-border bg-bg-2 px-2 py-1.5 text-13 text-fg-0 outline-none placeholder:text-fg-2 focus:border-accent focus:shadow-glow'
				/>
			)}
		</section>
	);
}
