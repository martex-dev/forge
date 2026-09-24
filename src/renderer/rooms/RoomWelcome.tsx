import type { LucideIcon } from 'lucide-react';
import type { JSX } from 'react';

import type { RoomId } from '@shared/rooms';

import { Badge } from '../ui/Badge';
import { Kbd } from '../ui/Kbd';

export interface WelcomeItem {
	title: string;
	detail: string;
	phase: number;
}

interface RoomWelcomeProps {
	room: RoomId;
	icon: LucideIcon;
	heading: string;
	tagline: string;
	items: WelcomeItem[];
}

/** Placeholder content for a room until its real panels land. */
export function RoomWelcome({
	icon: Icon,
	heading,
	tagline,
	items,
}: RoomWelcomeProps): JSX.Element {
	return (
		<div className='h-full overflow-auto bg-bg-1 p-6'>
			<div className='mx-auto flex max-w-2xl flex-col gap-5'>
				<header className='flex items-center gap-3'>
					<span className='flex size-10 items-center justify-center rounded-md border border-border bg-bg-2 text-accent'>
						<Icon size={20} />
					</span>
					<div>
						<h1 className='text-20 font-semibold text-fg-0'>{heading}</h1>
						<p className='text-13 text-fg-1'>{tagline}</p>
					</div>
				</header>
				<ul className='flex flex-col divide-y divide-border rounded-sm border border-border'>
					{items.map((item) => (
						<li key={item.title} className='flex items-start gap-3 px-3 py-2.5'>
							<span className='mt-1.5 size-1.5 shrink-0 rounded-full bg-accent' />
							<div className='min-w-0 flex-1'>
								<p className='text-13 font-medium text-fg-0'>{item.title}</p>
								<p className='text-12 text-fg-2'>{item.detail}</p>
							</div>
							<Badge>Phase {item.phase}</Badge>
						</li>
					))}
				</ul>
				<p className='flex items-center gap-2 text-12 text-fg-2'>
					Press <Kbd keys='Ctrl+K' /> for commands, <Kbd keys='Ctrl+1' />…
					<Kbd keys='Ctrl+4' /> to switch rooms.
				</p>
			</div>
		</div>
	);
}
