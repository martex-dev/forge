import { Settings } from 'lucide-react';
import type { CSSProperties, JSX } from 'react';

import { ROOMS } from '@shared/rooms';

import { cn } from '../lib/cn';
import { useUiStore } from '../stores/ui-store';
import { Tooltip } from '../ui/Tooltip';
import { ROOM_ICONS } from './commands/builtin-commands';

export function RoomRail(): JSX.Element {
	const room = useUiStore((s) => s.room);
	const playground = useUiStore((s) => s.playgroundOpen);
	const setRoom = useUiStore((s) => s.setRoom);
	const openSettings = useUiStore((s) => s.openSettings);

	return (
		<nav
			aria-label='Rooms'
			className='flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg-0 py-2'
		>
			{ROOMS.map((r) => {
				const Icon = ROOM_ICONS[r.id];
				const active = r.id === room && !playground;
				return (
					<Tooltip key={r.id} content={r.name} shortcut={r.shortcut} side='right'>
						<button
							type='button'
							aria-label={`${r.name} room`}
							aria-current={active ? 'page' : undefined}
							onClick={() => setRoom(r.id)}
							// Each button previews its own room's accent, so the rail reads as a legend.
							style={{ '--accent': `var(--accent-${r.id})` } as CSSProperties}
							className={cn(
								'relative flex size-9 items-center justify-center rounded-sm transition-colors transition-fast',
								'focus-visible:shadow-glow focus-visible:outline-none',
								active
									? 'bg-accent-soft text-accent'
									: 'text-fg-2 hover:bg-bg-3 hover:text-fg-0',
							)}
						>
							<span
								aria-hidden
								className={cn(
									'absolute top-1.5 bottom-1.5 -left-1.5 w-0.5 rounded-full bg-accent transition-opacity transition-fast',
									active ? 'opacity-100' : 'opacity-0',
								)}
							/>
							{Icon && <Icon size={18} />}
						</button>
					</Tooltip>
				);
			})}
			<div className='flex-1' />
			<Tooltip content='Settings' shortcut='Ctrl+,' side='right'>
				<button
					type='button'
					aria-label='Settings'
					onClick={() => openSettings()}
					className='flex size-9 items-center justify-center rounded-sm text-fg-2 transition-colors transition-fast hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
				>
					<Settings size={18} />
				</button>
			</Tooltip>
		</nav>
	);
}
