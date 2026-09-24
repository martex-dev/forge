import { LayoutGrid } from 'lucide-react';
import type { JSX } from 'react';

import { useUiStore } from '../../stores/ui-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Kbd } from '../../ui/Kbd';
import { resetRoomLayout } from './reset-layout';

/** Shown by dockview when a room has no panels open. */
export function LayoutWatermark(): JSX.Element {
	const room = useUiStore((s) => s.room);
	return (
		<EmptyState
			className='bg-bg-0'
			icon={<LayoutGrid size={24} />}
			title='No panels open'
			description={
				<span className='inline-flex items-center gap-1'>
					Open one from the command palette <Kbd keys='Ctrl+K' /> or restore the defaults.
				</span>
			}
			action={
				<Button size='sm' onClick={() => void resetRoomLayout(room)}>
					Reset layout
				</Button>
			}
		/>
	);
}
