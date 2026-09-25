import { ContextMenu } from 'radix-ui';
import type { JSX, ReactNode } from 'react';
import { useState } from 'react';

import { useRegisterOverlay } from '../../stores/overlay-store';
import { Kbd } from '../../ui/Kbd';

export interface MenuItem {
	label: string;
	shortcut?: string;
	danger?: boolean;
	disabled?: boolean;
	onSelect: () => void;
}

interface ExplorerContextMenuProps {
	items: Array<MenuItem | 'separator'>;
	children: ReactNode;
}

const itemClass =
	'flex h-7 cursor-default items-center gap-4 rounded-sm px-2 text-12 outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-bg-3';

/** Right-click menu; registered as an overlay so webviews never cover it. */
export function ExplorerContextMenu({ items, children }: ExplorerContextMenuProps): JSX.Element {
	const [open, setOpen] = useState(false);
	useRegisterOverlay(open);
	return (
		<ContextMenu.Root onOpenChange={setOpen}>
			<ContextMenu.Trigger asChild>{children}</ContextMenu.Trigger>
			<ContextMenu.Portal>
				<ContextMenu.Content className='z-50 min-w-48 rounded-sm border border-border-strong bg-bg-2 p-1 shadow-xl'>
					{items.map((item, i) =>
						item === 'separator' ? (
							<ContextMenu.Separator
								key={`sep-${i}`}
								className='my-1 h-px bg-border'
							/>
						) : (
							<ContextMenu.Item
								key={item.label}
								disabled={item.disabled ?? false}
								onSelect={item.onSelect}
								className={`${itemClass} ${item.danger ? 'text-down' : 'text-fg-1 data-[highlighted]:text-fg-0'}`}
							>
								<span className='flex-1'>{item.label}</span>
								{item.shortcut && <Kbd keys={item.shortcut} />}
							</ContextMenu.Item>
						),
					)}
				</ContextMenu.Content>
			</ContextMenu.Portal>
		</ContextMenu.Root>
	);
}
