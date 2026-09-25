import { Cpu } from 'lucide-react';
import type { JSX } from 'react';

import { commandContext } from '../../app/commands/use-commands';
import { cn } from '../../lib/cn';
import { temperatureLevel } from './gpu-model';
import { useGpu } from './use-gpu';

/** "GPU 44% · 61°C" in the status bar, visible from every room while training. */
export function GpuStatusItem(): JSX.Element | null {
	const { snapshot } = useGpu();
	const gpu = snapshot?.available ? snapshot.gpus[0] : undefined;
	if (!gpu) return null;
	const level = temperatureLevel(gpu.temperature);
	return (
		<button
			type='button'
			onClick={() => commandContext.openPanel('gpu.monitor')}
			title={`${gpu.name}${snapshot && snapshot.gpus.length > 1 ? ` (+${snapshot.gpus.length - 1})` : ''}`}
			className='num flex items-center gap-1 rounded-sm px-1 text-fg-1 hover:bg-bg-3 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none'
			data-gpu-status
		>
			<Cpu size={12} />
			<span>{gpu.utilization ?? '—'}%</span>
			{gpu.temperature !== null && (
				<span
					className={cn(level === 'warn' && 'text-warn', level === 'hot' && 'text-down')}
				>
					{gpu.temperature}°C
				</span>
			)}
		</button>
	);
}
