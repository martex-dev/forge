import { ArrowDown, ArrowUp, Play, Trash2 } from 'lucide-react';
import { type JSX, type KeyboardEvent, useMemo, useRef, useState } from 'react';

import type { NbCell } from '@shared/ipc/channels/notebooks';

import { cn } from '../../lib/cn';
import { renderMarkdown } from '../../lib/markdown/markdown';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import type { RunState } from './notebook-model';
import { OutputArea } from './OutputArea';

import '../../lib/markdown/markdown.css';

export interface CellHandlers {
	onEdit(source: string): void;
	onRun(advance: 'stay' | 'next' | 'insert'): void;
	onMove(by: -1 | 1): void;
	onRemove(): void;
	onType(type: NbCell['cell_type']): void;
	onFocus(): void;
}

function rowsFor(source: string): number {
	return Math.min(40, Math.max(1, source.split('\n').length));
}

export function NbCellView({
	cell,
	index,
	active,
	run,
	handlers,
}: {
	cell: NbCell;
	index: number;
	active: boolean;
	run: RunState | undefined;
	handlers: CellHandlers;
}): JSX.Element {
	const [editingMd, setEditingMd] = useState(cell.source === '');
	const ref = useRef<HTMLTextAreaElement>(null);
	const isCode = cell.cell_type === 'code';
	const showEditor = isCode || cell.cell_type === 'raw' || editingMd;
	const html = useMemo(
		() => (cell.cell_type === 'markdown' && !editingMd ? renderMarkdown(cell.source) : ''),
		[cell.cell_type, cell.source, editingMd],
	);

	const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>): void => {
		if (e.key === 'Enter' && (e.shiftKey || e.ctrlKey || e.altKey)) {
			e.preventDefault();
			if (cell.cell_type === 'markdown') setEditingMd(false);
			handlers.onRun(e.shiftKey ? 'next' : e.altKey ? 'insert' : 'stay');
		} else if (e.key === 'Tab' && !e.shiftKey) {
			// Four spaces, as Python wants, instead of leaving the cell.
			e.preventDefault();
			const el = e.currentTarget;
			const { selectionStart: s, selectionEnd: end } = el;
			handlers.onEdit(`${cell.source.slice(0, s)}    ${cell.source.slice(end)}`);
			requestAnimationFrame(() => el.setSelectionRange(s + 4, s + 4));
		} else if (e.key === 'Escape') {
			if (cell.cell_type === 'markdown') setEditingMd(false);
			e.currentTarget.blur();
		}
	};

	return (
		<div
			className={cn(
				'group relative flex border-l-2 bg-bg-1',
				active ? 'border-accent' : 'border-transparent hover:border-border-strong',
			)}
			data-nb-cell={index}
			data-nb-type={cell.cell_type}
			onFocusCapture={handlers.onFocus}
		>
			<div className='num w-12 shrink-0 pt-2 pr-1 text-right text-11 text-fg-2'>
				{isCode &&
					(run ? (
						<span
							title={run === 'queued' ? 'Queued' : 'Running'}
							className='inline-flex'
						>
							{run === 'running' ? <Spinner size={12} /> : '[*]'}
						</span>
					) : (
						`[${cell.execution_count ?? ' '}]`
					))}
			</div>
			<div className='min-w-0 flex-1 py-1 pr-2'>
				{showEditor ? (
					<textarea
						ref={ref}
						value={cell.source}
						onChange={(e) => handlers.onEdit(e.target.value)}
						onKeyDown={onKeyDown}
						rows={rowsFor(cell.source)}
						spellCheck={cell.cell_type === 'markdown'}
						aria-label={`Cell ${index + 1} (${cell.cell_type})`}
						autoFocus={cell.cell_type === 'markdown' && editingMd && cell.source === ''}
						className={cn(
							'selectable w-full resize-none rounded-sm border border-border bg-bg-2 px-2 py-1.5 text-12 leading-5 text-fg-0 outline-none focus:border-accent focus:shadow-glow',
							isCode && 'num',
						)}
					/>
				) : (
					<div
						role='button'
						tabIndex={0}
						aria-label={`Markdown cell ${index + 1}, press Enter to edit`}
						className='md-preview min-h-6 cursor-text rounded-sm px-2 py-1 text-13 focus-visible:shadow-glow focus-visible:outline-none'
						onDoubleClick={() => setEditingMd(true)}
						onKeyDown={(e) => {
							if (e.key === 'Enter') {
								e.preventDefault();
								setEditingMd(true);
							}
						}}
						dangerouslySetInnerHTML={{
							__html: html || '<p class="text-fg-2">Empty Markdown cell</p>',
						}}
					/>
				)}
				{isCode && <OutputArea outputs={cell.outputs} />}
			</div>
			<div className='absolute top-1 right-2 flex gap-0.5 rounded-sm bg-bg-2 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'>
				<select
					aria-label='Cell type'
					value={cell.cell_type}
					onChange={(e) => handlers.onType(e.target.value as NbCell['cell_type'])}
					className='h-6 rounded-sm bg-bg-2 px-1 text-11 text-fg-1 outline-none focus-visible:shadow-glow'
				>
					<option value='code'>Code</option>
					<option value='markdown'>Markdown</option>
					<option value='raw'>Raw</option>
				</select>
				{isCode && (
					<IconButton
						label='Run cell (Ctrl+Enter)'
						size='sm'
						icon={<Play size={11} />}
						onClick={() => handlers.onRun('stay')}
					/>
				)}
				<IconButton
					label='Move up'
					size='sm'
					icon={<ArrowUp size={11} />}
					onClick={() => handlers.onMove(-1)}
				/>
				<IconButton
					label='Move down'
					size='sm'
					icon={<ArrowDown size={11} />}
					onClick={() => handlers.onMove(1)}
				/>
				<IconButton
					label='Delete cell'
					size='sm'
					icon={<Trash2 size={11} />}
					onClick={handlers.onRemove}
				/>
			</div>
		</div>
	);
}
