import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink, FilePlus2, Plus } from 'lucide-react';
import { type JSX, type MouseEvent, useMemo, useState } from 'react';

import type { NotionPageSummary } from '@shared/ipc/channels/notion';

import { call } from '../../lib/ipc';
import { renderMarkdown } from '../../lib/markdown/markdown';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Spinner } from '../../ui/Spinner';

import '../../lib/markdown/markdown.css';

type Kind = 'to_do' | 'paragraph' | 'bulleted_list_item';

/** Links open in the system browser; the app window never navigates. */
function onLinkClick(e: MouseEvent<HTMLElement>): void {
	const anchor = (e.target as HTMLElement).closest('a');
	if (!anchor) return;
	e.preventDefault();
	if (/^https?:\/\//.test(anchor.href)) {
		call('app:openExternal', anchor.href).catch(() => toast.error('Could not open link'));
	}
}

export function NotionPageView({
	id,
	onOpen,
}: {
	id: string;
	onOpen: (page: NotionPageSummary) => void;
}): JSX.Element {
	const client = useQueryClient();
	const page = useQuery({
		queryKey: ['notion', 'page', id],
		queryFn: () => call('notion:page', id),
	});
	const html = useMemo(() => (page.data ? renderMarkdown(page.data.markdown) : ''), [page.data]);
	const [kind, setKind] = useState<Kind>('to_do');
	const [text, setText] = useState('');
	const [newTitle, setNewTitle] = useState<string | null>(null);
	const append = useMutation({
		mutationFn: () => call('notion:append', { id, kind, text }),
		onSuccess: () => {
			setText('');
			void client.invalidateQueries({ queryKey: ['notion', 'page', id] });
		},
		onError: (e) => toast.error('Not added', e.message),
	});
	const create = useMutation({
		mutationFn: (title: string) => call('notion:create', { parentId: id, title }),
		onSuccess: (created) => {
			setNewTitle(null);
			void client.invalidateQueries({ queryKey: ['notion', 'search'] });
			void client.invalidateQueries({ queryKey: ['notion', 'page', id] });
			onOpen(created);
		},
		onError: (e) => toast.error('Page not created', e.message),
	});

	if (page.isPending) {
		return (
			<div className='flex flex-1 items-center justify-center'>
				<Spinner label='Loading page' />
			</div>
		);
	}
	if (page.isError) {
		return (
			<ErrorState
				title='Page unavailable'
				message={page.error.message}
				onRetry={() => void page.refetch()}
				className='flex-1'
			/>
		);
	}
	const p = page.data;
	return (
		<div className='flex min-w-0 flex-1 flex-col' data-notion-page={p.title}>
			<header className='flex items-center gap-2 border-b border-border px-3 py-1.5'>
				<h2 className='min-w-0 flex-1 truncate text-14 font-semibold text-fg-0'>
					{p.icon ? `${p.icon} ` : ''}
					{p.title}
				</h2>
				<IconButton
					label='New sub-page'
					size='sm'
					icon={<FilePlus2 size={12} />}
					onClick={() => setNewTitle('')}
				/>
				<IconButton
					label='Open in Notion'
					size='sm'
					icon={<ExternalLink size={12} />}
					onClick={() =>
						void call('app:openExternal', p.url).catch(() =>
							toast.error('Could not open Notion'),
						)
					}
				/>
			</header>
			{newTitle !== null && (
				<form
					className='flex gap-2 border-b border-border px-3 py-1.5'
					onSubmit={(e) => {
						e.preventDefault();
						if (newTitle.trim()) create.mutate(newTitle.trim());
					}}
				>
					<Input
						autoFocus
						value={newTitle}
						onChange={(e) => setNewTitle(e.target.value)}
						placeholder='Sub-page title'
						aria-label='Sub-page title'
						className='flex-1'
					/>
					<Button type='submit' size='sm' variant='primary' loading={create.isPending}>
						Create
					</Button>
					<Button size='sm' variant='ghost' onClick={() => setNewTitle(null)}>
						Cancel
					</Button>
				</form>
			)}
			<div className='min-h-0 flex-1 overflow-y-auto px-4 py-3'>
				{/* markdown-it with html:false: page content can't inject markup. */}
				<div
					className='md-preview text-13'
					onClick={onLinkClick}
					dangerouslySetInnerHTML={{ __html: html || '<p>Empty page.</p>' }}
				/>
				{p.truncated && (
					<p className='mt-3 text-11 text-fg-2'>Long page: the rest is in Notion.</p>
				)}
			</div>
			<form
				className='flex gap-2 border-t border-border px-3 py-1.5'
				onSubmit={(e) => {
					e.preventDefault();
					if (text.trim()) append.mutate();
				}}
			>
				<Select
					aria-label='Block type'
					className='h-7 min-w-28'
					value={kind}
					onValueChange={(v) => setKind(v as Kind)}
					options={[
						{ value: 'to_do', label: 'To-do' },
						{ value: 'paragraph', label: 'Text' },
						{ value: 'bulleted_list_item', label: 'Bullet' },
					]}
				/>
				<Input
					value={text}
					onChange={(e) => setText(e.target.value)}
					placeholder='Add to the end of this page (Enter)'
					aria-label='Append text'
					className='flex-1'
				/>
				<Button
					type='submit'
					size='sm'
					icon={<Plus size={12} />}
					loading={append.isPending}
					disabled={!text.trim()}
				>
					Add
				</Button>
			</form>
		</div>
	);
}
