import { useQuery } from '@tanstack/react-query';
import { ChevronsDown, Eraser, Plus, RotateCcw, Square } from 'lucide-react';
import type { JSX } from 'react';

import type { KernelChoice } from '@shared/ipc/channels/notebooks';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { Button } from '../../ui/Button';
import { IconButton } from '../../ui/IconButton';
import { Select } from '../../ui/Select';
import type { Kernel } from './use-kernel';

const PICK_PYTHON = '__python__';

const STATUS: Record<Kernel['status'], { label: string; dot: string }> = {
	none: { label: 'No kernel', dot: 'bg-fg-2' },
	starting: { label: 'Starting…', dot: 'bg-warn' },
	idle: { label: 'Idle', dot: 'bg-up' },
	busy: { label: 'Busy', dot: 'bg-accent' },
	dead: { label: 'Kernel died', dot: 'bg-down' },
};

export function KernelBar({
	kernel,
	saveState,
	onPick,
	onRunAll,
	onClear,
	onAdd,
}: {
	kernel: Kernel;
	saveState: string;
	onPick: (choice: KernelChoice) => void;
	onRunAll: () => void;
	onClear: () => void;
	onAdd: () => void;
}): JSX.Element {
	const specs = useQuery({
		queryKey: ['nb', 'kernelspecs'],
		queryFn: () => call('nb:kernelspecs'),
		meta: SIDECAR_META,
		staleTime: 60_000,
	});
	const status = STATUS[kernel.status];
	const pick = (value: string): void => {
		if (value !== PICK_PYTHON) {
			onPick({ spec: value });
			return;
		}
		void call('nb:pickPython').then((python) => python && onPick({ python }));
	};

	return (
		<header
			className='flex flex-wrap items-center gap-1.5 border-b border-border px-2 py-1'
			data-nb-kernel={kernel.status}
		>
			<Button
				size='sm'
				variant='primary'
				icon={<ChevronsDown size={12} />}
				onClick={onRunAll}
				disabled={kernel.status === 'none' || kernel.status === 'dead'}
			>
				Run all
			</Button>
			<IconButton
				label='Interrupt kernel'
				size='sm'
				icon={<Square size={11} />}
				onClick={kernel.interrupt}
				disabled={kernel.status !== 'busy'}
			/>
			<IconButton
				label='Restart kernel'
				size='sm'
				icon={<RotateCcw size={12} />}
				onClick={kernel.restart}
				disabled={kernel.status === 'none' || kernel.status === 'dead'}
			/>
			<IconButton
				label='Clear all outputs'
				size='sm'
				icon={<Eraser size={12} />}
				onClick={onClear}
			/>
			<IconButton label='Add cell' size='sm' icon={<Plus size={12} />} onClick={onAdd} />
			<span className='ml-auto text-11 text-fg-2' data-nb-save={saveState}>
				{saveState}
			</span>
			<span className='flex items-center gap-1.5 text-11 text-fg-1'>
				<span className={cn('size-2 rounded-full', status.dot)} />
				{kernel.label && kernel.status !== 'none' && kernel.status !== 'dead' ? (
					<span className='num max-w-56 truncate' title={kernel.label}>
						{kernel.label}
					</span>
				) : null}
				<span className='text-fg-2'>{status.label}</span>
			</span>
			{(kernel.status === 'none' || kernel.status === 'dead') && (
				<Select
					aria-label='Kernel'
					className='h-6 min-w-40'
					value=''
					placeholder={specs.data?.length ? 'Pick a kernel…' : 'Pick an interpreter…'}
					onValueChange={pick}
					options={[
						...(specs.data ?? []).map((s) => ({ value: s.name, label: s.displayName })),
						{ value: PICK_PYTHON, label: 'Python interpreter… (needs ipykernel)' },
					]}
				/>
			)}
		</header>
	);
}
