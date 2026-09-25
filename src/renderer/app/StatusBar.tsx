import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell } from 'lucide-react';
import { type JSX, useEffect, useMemo, useState } from 'react';

import { call } from '../lib/ipc';
import { useForgeEvent } from '../lib/use-forge-event';
import { RENDERER_MODULES } from '../modules/registry';
import type { StatusItemDefinition } from '../modules/types';
import { commandContext } from './commands/use-commands';
import { useModules } from './hooks/use-modules';
import { INBOX_PANEL } from './notifications';
import { SidecarIndicator } from './SidecarIndicator';
import { UpdateIndicator } from './UpdateIndicator';

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

function ModuleItems({ items }: { items: StatusItemDefinition[] }): JSX.Element {
	return (
		<>
			{items.map(({ id, component: Item }) => (
				<Item key={id} />
			))}
		</>
	);
}

export function StatusBar(): JSX.Element {
	const client = useQueryClient();
	const { enabled } = useModules();
	const unread = useQuery({
		queryKey: UNREAD_KEY,
		queryFn: () => call('notifications:unreadCount'),
	});
	useForgeEvent('notifications:changed', ({ unreadCount }) =>
		client.setQueryData(UNREAD_KEY, unreadCount),
	);

	// Modules contribute items (git branch, run status…); disabled modules' items disappear.
	const [left, right] = useMemo(() => {
		const items = RENDERER_MODULES.filter((m) => enabled.has(m.manifest.id))
			.flatMap((m) => m.statusItems ?? [])
			.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
		return [items.filter((i) => i.side === 'left'), items.filter((i) => i.side === 'right')];
	}, [enabled]);

	return (
		<footer className='flex h-6 shrink-0 items-center gap-4 border-t border-border bg-bg-0 px-3 text-11 text-fg-2'>
			<SidecarIndicator />
			<ModuleItems items={left} />
			<div className='flex-1' />
			<ModuleItems items={right} />
			<UpdateIndicator />
			<button
				type='button'
				onClick={() => commandContext.openPanel(INBOX_PANEL)}
				className='flex items-center gap-1 rounded-sm px-1 hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
				title={
					unread.isError
						? 'Could not load notifications'
						: 'Unread notifications (open inbox)'
				}
				data-unread={unread.data ?? 0}
			>
				<Bell size={12} className={(unread.data ?? 0) > 0 ? 'text-accent' : undefined} />
				<span className='num'>{unread.isError ? '!' : (unread.data ?? 0)}</span>
			</button>
			<Clock />
		</footer>
	);
}
