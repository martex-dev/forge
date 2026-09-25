import { ChevronDown, ChevronRight } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import type { PullFile } from '@shared/ipc/channels/github';

import { cn } from '../../lib/cn';
import { parsePatch } from './patch';

const ROW: Record<string, string> = {
	add: 'bg-up-soft',
	del: 'bg-down-soft',
	hunk: 'bg-info-soft text-info',
	meta: 'text-fg-2 italic',
	ctx: '',
};

function FileDiff({ file }: { file: PullFile }): JSX.Element {
	// Big diffs start collapsed so the page stays fast; one click shows them.
	const [open, setOpen] = useState(file.additions + file.deletions <= 400);
	const lines = useMemo(
		() => (open && file.patch ? parsePatch(file.patch) : []),
		[open, file.patch],
	);
	return (
		<section
			className='overflow-hidden rounded-sm border border-border'
			data-pr-file={file.path}
		>
			<button
				type='button'
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				className='flex w-full items-center gap-2 bg-bg-2 px-2 py-1 text-left text-12 hover:bg-bg-3 focus-visible:shadow-glow focus-visible:outline-none'
			>
				{open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
				<span className='min-w-0 flex-1 truncate font-mono text-fg-0'>
					{file.previousPath ? `${file.previousPath} → ` : ''}
					{file.path}
				</span>
				<span className='text-11 text-fg-2'>{file.status}</span>
				<span className='num text-11 text-up'>+{file.additions}</span>
				<span className='num text-11 text-down'>-{file.deletions}</span>
			</button>
			{open &&
				(file.patch === null ? (
					<p className='px-3 py-2 text-12 text-fg-2'>
						Binary file or diff too large to show.
					</p>
				) : (
					<div className='overflow-x-auto'>
						<table className='w-full border-collapse font-mono text-12'>
							<tbody>
								{lines.map((l, i) => (
									<tr key={i} className={ROW[l.kind]}>
										<td className='num w-10 pr-1 text-right align-top text-11 text-fg-2 select-none'>
											{l.oldLine ?? ''}
										</td>
										<td className='num w-10 pr-2 text-right align-top text-11 text-fg-2 select-none'>
											{l.newLine ?? ''}
										</td>
										<td
											className={cn(
												'selectable pr-3 whitespace-pre',
												l.kind === 'add' && 'text-fg-0',
												l.kind === 'del' && 'text-fg-1',
											)}
										>
											{l.kind === 'add'
												? '+'
												: l.kind === 'del'
													? '-'
													: l.kind === 'ctx'
														? ' '
														: ''}
											{l.text}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				))}
		</section>
	);
}

export function PatchView({ files }: { files: PullFile[] }): JSX.Element {
	return (
		<div className='flex flex-col gap-2' aria-label='Changed files'>
			{files.map((f) => (
				<FileDiff key={f.path} file={f} />
			))}
		</div>
	);
}
