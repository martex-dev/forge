import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { BookText, KeyRound, Search } from 'lucide-react';
import { type JSX, useEffect, useState } from 'react';

import { commandContext } from '../../app/commands/use-commands';
import { cn } from '../../lib/cn';
import { formatAge } from '../../lib/format';
import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';
import { useNow } from '../../lib/use-now';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { NotionPageView } from './NotionPageView';

export function NotionPanel({ params, setParams }: PanelProps): JSX.Element {
	const client = useQueryClient();
	const now = useNow(60_000);
	const status = useQuery({
		queryKey: ['notion', 'status'],
		queryFn: () => call('notion:status'),
	});
	useForgeEvent('secrets:changed', ({ key }) => {
		if (key === 'notion.token') void client.invalidateQueries({ queryKey: ['notion'] });
	});
	const [query, setQuery] = useState('');
	const [debounced, setDebounced] = useState('');
	useEffect(() => {
		const t = setTimeout(() => setDebounced(query.trim()), 300);
		return () => clearTimeout(t);
	}, [query]);
	const results = useQuery({
		queryKey: ['notion', 'search', debounced],
		queryFn: () => call('notion:search', { query: debounced }),
		enabled: status.data?.hasToken === true,
		placeholderData: keepPreviousData,
		retry: false,
	});
	const selected = typeof params['page'] === 'string' ? params['page'] : null;

	if (status.isPending) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Loading Notion' />
			</div>
		);
	}
	if (!status.data?.hasToken) {
		return (
			<EmptyState
				icon={<KeyRound size={20} />}
				title='Connect Notion'
				description='Create an internal integration at notion.so/profile/integrations, add its secret in Settings → Secrets, then share pages with it (••• → Connections).'
				action={
					<Button
						size='sm'
						variant='primary'
						onClick={() => commandContext.openSettings('secrets')}
					>
						Open Secrets
					</Button>
				}
				className='h-full bg-bg-1'
			/>
		);
	}
	return (
		<div className='flex h-full bg-bg-1' data-notion>
			<aside className='flex w-64 shrink-0 flex-col border-r border-border'>
				<div className='border-b border-border p-2'>
					<Input
						leading={<Search size={12} />}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder='Search pages'
						aria-label='Search Notion'
					/>
				</div>
				{results.isError ? (
					<ErrorState
						title='Search failed'
						message={results.error.message}
						onRetry={() => void results.refetch()}
					/>
				) : !results.data ? (
					<Spinner label='Searching' />
				) : results.data.length === 0 ? (
					<EmptyState
						icon={<BookText size={18} />}
						title='No pages'
						description='Only pages shared with the integration show up.'
					/>
				) : (
					<ul className='min-h-0 flex-1 overflow-y-auto' aria-label='Pages'>
						{results.data.map((p) => (
							<li key={p.id}>
								<button
									type='button'
									onClick={() => setParams({ page: p.id })}
									aria-current={selected === p.id}
									className={cn(
										'flex w-full flex-col items-start px-3 py-1.5 text-left hover:bg-bg-3 focus-visible:bg-bg-3 focus-visible:outline-none',
										selected === p.id && 'bg-accent-soft',
									)}
									data-notion-result={p.title}
								>
									<span className='w-full truncate text-13 text-fg-0'>
										{p.icon ? `${p.icon} ` : ''}
										{p.title}
									</span>
									<span className='num text-11 text-fg-2'>
										edited {formatAge(p.lastEdited, now)} ago
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</aside>
			{selected ? (
				<NotionPageView
					key={selected}
					id={selected}
					onOpen={(p) => setParams({ page: p.id })}
				/>
			) : (
				<EmptyState
					icon={<BookText size={20} />}
					title='Pick a page'
					description='Search on the left, or pick a recently edited page.'
					className='flex-1'
				/>
			)}
		</div>
	);
}
