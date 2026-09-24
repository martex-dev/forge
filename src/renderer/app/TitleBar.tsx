import { Search } from 'lucide-react';
import type { JSX } from 'react';

import { ROOMS } from '@shared/rooms';

import { useUiStore } from '../stores/ui-store';
import { Kbd } from '../ui/Kbd';

/** Height must match titleBarOverlay.height in main (window controls are drawn natively on the right). */
export const TITLE_BAR_HEIGHT = 36;

export function TitleBar(): JSX.Element {
	const room = useUiStore((s) => s.room);
	const playground = useUiStore((s) => s.playgroundOpen);
	const openPalette = useUiStore((s) => s.setPaletteOpen);
	const roomName = ROOMS.find((r) => r.id === room)?.name ?? '';

	return (
		<header
			className='drag relative flex shrink-0 items-center border-b border-border bg-bg-0 pr-36 pl-3'
			style={{ height: TITLE_BAR_HEIGHT }}
		>
			<div className='flex items-center gap-2'>
				<span aria-hidden className='size-2.5 rotate-45 bg-accent shadow-glow' />
				<span className='text-13 font-semibold tracking-wide text-fg-0'>FORGE</span>
				<span className='text-fg-2'>/</span>
				<span className='text-13 text-fg-1'>
					{playground ? 'Design Playground' : roomName}
				</span>
			</div>

			<button
				type='button'
				onClick={() => openPalette(true)}
				className='no-drag absolute left-1/2 flex h-6 w-[min(420px,40vw)] -translate-x-1/2 items-center gap-2 rounded-sm border border-border bg-bg-2 px-2 text-12 text-fg-2 transition-colors transition-fast hover:border-border-strong hover:text-fg-1 focus-visible:shadow-glow focus-visible:outline-none'
			>
				<Search size={12} />
				<span className='flex-1 text-left'>Search commands…</span>
				<Kbd keys='Ctrl+K' />
			</button>
		</header>
	);
}
