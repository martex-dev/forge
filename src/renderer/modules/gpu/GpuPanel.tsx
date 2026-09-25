import { Cpu } from 'lucide-react';
import type { JSX } from 'react';

import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { GpuCard } from './GpuCard';
import { useGpu, useGpuHistory } from './use-gpu';

export function GpuPanel(): JSX.Element {
	const { snapshot, isLoading, error, refetch } = useGpu();
	const history = useGpuHistory((s) => s.history);

	if (isLoading) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Reading GPU' />
			</div>
		);
	}
	if (error && !snapshot) {
		return (
			<ErrorState title='GPU monitor unavailable' message={error.message} onRetry={refetch} />
		);
	}
	if (!snapshot?.available || snapshot.gpus.length === 0) {
		return (
			<EmptyState
				icon={<Cpu size={20} />}
				title='No NVIDIA GPU detected'
				description={snapshot?.reason ?? 'NVML reported no devices.'}
			/>
		);
	}
	return (
		<div className='flex h-full flex-col gap-2 overflow-y-auto bg-bg-1 p-2'>
			{snapshot.gpus.map((gpu) => (
				<GpuCard key={gpu.index} gpu={gpu} samples={history[gpu.index] ?? []} />
			))}
			{snapshot.driver && (
				<p className='num px-1 text-11 text-fg-2'>NVIDIA driver {snapshot.driver}</p>
			)}
		</div>
	);
}
