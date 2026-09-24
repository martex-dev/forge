import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, GitBranch } from 'lucide-react';
import { type JSX, useEffect, useState } from 'react';

import { call } from '../lib/ipc';
import { useForgeEvent } from '../lib/use-forge-event';
import { SidecarIndicator } from './SidecarIndicator';

const UNREAD_KEY = ['notifications', 'unread'] as const;

function Clock(): JSX.Element {
	const [now, setNow] = useState(() => new Date());
	useEffect(() => {
		const id = setInterval(() => setNow(new Date()), 1000);
		return () => clearInterval(id);
	}, []);
	return (
		<time className='num text-fg-1' dateTime={now.toISOString()}>
			{now.toLocaleTimeString([], {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hour12: false,
			})}
		</time>
	);
}

export function StatusBar(): JSX.Element {
	const client = useQueryClient();
	const unread = useQuery({
		queryKey: UNREAD_KEY,
		queryFn: () => call('notifications:unreadCount'),
	});
	useForgeEvent('notifications:changed', ({ unreadCount }) =>
		client.setQueryData(UNREAD_KEY, unreadCount),
	);

	return (
		<footer className='flex h-6 shrink-0 items-center gap-4 border-t border-border bg-bg-0 px-3 text-11 text-fg-2'>
			<SidecarIndicator />
			{/* TODO(phase-1): show the open folder's branch once the Git module exists. */}
			<span className='flex items-center gap-1' title='No repository open'>
				<GitBranch size={12} />
				<span>—</span>
			</span>
			<div className='flex-1' />
			<span
				className='flex items-center gap-1'
				title={unread.isError ? 'Could not load notifications' : 'Unread notifications'}
			>
				<Bell size={12} className={(unread.data ?? 0) > 0 ? 'text-accent' : undefined} />
				<span className='num'>{unread.isError ? '!' : (unread.data ?? 0)}</span>
			</span>
			<Clock />
		</footer>
	);
}
