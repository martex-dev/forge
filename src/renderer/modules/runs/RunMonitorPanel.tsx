import { GitCompareArrows } from 'lucide-react';
import type { JSX } from 'react';

import { commandContext } from '../../app/commands/use-commands';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { defaultComparison } from './compare-model';
import { ProbeSetup } from './ProbeSetup';
import { RunList } from './RunList';
import { RunView } from './RunView';
import { useRuns } from './use-runs';

export function RunMonitorPanel({ params, setParams }: PanelProps): JSX.Element {
	const { runs, isLoading, error, refetch } = useRuns();
	const picked = typeof params['runId'] === 'string' ? params['runId'] : null;
	// Nothing picked (or it was deleted): follow the newest run, so a fresh run shows up by itself.
	const selected = runs.find((r) => r.id === picked) ?? runs[0] ?? null;

	if (isLoading) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Loading runs' />
			</div>
		);
	}
	if (error && runs.length === 0) {
		return <ErrorState title='Runs unavailable' message={error.message} onRetry={refetch} />;
	}
	if (!selected) {
		return (
			<div className='h-full overflow-auto bg-bg-1'>
				<ProbeSetup />
			</div>
		);
	}
	return (
		<div className='flex h-full bg-bg-1'>
			<div className='flex w-64 shrink-0 flex-col border-r border-border'>
				<div className='flex items-center border-b border-border py-0.5 pr-1 pl-3'>
					<span className='flex-1 text-11 font-medium tracking-wide text-fg-2 uppercase'>
						Runs ({runs.length})
					</span>
					<IconButton
						label='Compare with an earlier run…'
						size='sm'
						icon={<GitCompareArrows size={12} />}
						disabled={runs.length < 2}
						onClick={() =>
							commandContext.openPanel('runs.compare', {
								params: { ids: defaultComparison(runs, selected) },
							})
						}
					/>
				</div>
				<RunList
					runs={runs}
					selectedId={selected.id}
					// Picking the newest run clears the pin, so the view keeps following new runs.
					onSelect={(id) => setParams({ runId: id === runs[0]?.id ? undefined : id })}
				/>
			</div>
			<RunView key={selected.id} run={selected} />
		</div>
	);
}
