import { Command } from 'cmdk';
import { CornerDownLeft } from 'lucide-react';
import { type JSX, useMemo } from 'react';

import { ROOMS } from '@shared/rooms';

import type { CommandDefinition } from '../modules/types';
import { useRegisterOverlay } from '../stores/overlay-store';
import { useUiStore } from '../stores/ui-store';
import { Kbd } from '../ui/Kbd';
import { runCommand } from './commands/use-commands';

interface CommandPaletteProps {
	commands: readonly CommandDefinition[];
}

const GROUP_ORDER = ['global', ...ROOMS.map((r) => r.id)] as const;
const GROUP_LABEL: Record<string, string> = {
	global: 'General',
	...Object.fromEntries(ROOMS.map((r) => [r.id, r.name])),
};

export function CommandPalette({ commands }: CommandPaletteProps): JSX.Element {
	const open = useUiStore((s) => s.paletteOpen);
	const setOpen = useUiStore((s) => s.setPaletteOpen);
	const currentRoom = useUiStore((s) => s.room);
	useRegisterOverlay(open);

	// Current room's group comes right after General so relevant commands surface first.
	const groups = useMemo(() => {
		const order = [...GROUP_ORDER].sort((a, b) => rank(a, currentRoom) - rank(b, currentRoom));
		return order
			.map((group) => ({ group, items: commands.filter((c) => c.room === group) }))
			.filter((g) => g.items.length > 0);
	}, [commands, currentRoom]);

	return (
		<Command.Dialog
			open={open}
			onOpenChange={setOpen}
			label='Command palette'
			loop
			overlayClassName='fixed inset-0 z-40 bg-scrim'
			contentClassName='fixed top-[12vh] left-1/2 z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-md border border-border-strong bg-bg-1 shadow-2xl'
		>
			<div className='flex items-center gap-2 border-b border-border px-3'>
				<Command.Input
					autoFocus
					placeholder='Type a command…'
					className='h-11 flex-1 bg-transparent text-14 text-fg-0 outline-none placeholder:text-fg-2 focus-visible:outline-none'
				/>
				<Kbd keys='Esc' />
			</div>
			<Command.List className='max-h-[min(420px,60vh)] overflow-auto p-1'>
				<Command.Empty className='px-3 py-6 text-center text-13 text-fg-2'>
					No matching commands.
				</Command.Empty>
				{groups.map(({ group, items }) => (
					<Command.Group
						key={group}
						heading={GROUP_LABEL[group] ?? group}
						className='[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:text-11 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-fg-2 [&_[cmdk-group-heading]]:uppercase'
					>
						{items.map((command) => {
							const Icon = command.icon;
							return (
								<Command.Item
									key={command.id}
									value={`${command.title} ${command.id}`}
									keywords={command.keywords ?? []}
									onSelect={() => {
										setOpen(false);
										void runCommand(command);
									}}
									className='group flex h-8 cursor-default items-center gap-2 rounded-sm px-2 text-13 text-fg-1 data-[selected=true]:bg-bg-3 data-[selected=true]:text-fg-0'
								>
									{Icon ? (
										<Icon
											size={14}
											className='text-fg-2 group-data-[selected=true]:text-accent'
										/>
									) : (
										<span className='w-3.5' />
									)}
									<span className='flex-1 truncate'>{command.title}</span>
									{command.shortcut && <Kbd keys={command.shortcut} />}
									<CornerDownLeft
										size={12}
										className='hidden text-fg-2 group-data-[selected=true]:block'
									/>
								</Command.Item>
							);
						})}
					</Command.Group>
				))}
			</Command.List>
		</Command.Dialog>
	);
}

function rank(group: string, currentRoom: string): number {
	if (group === 'global') return 0;
	if (group === currentRoom) return 1;
	return 2 + GROUP_ORDER.indexOf(group as (typeof GROUP_ORDER)[number]);
}
