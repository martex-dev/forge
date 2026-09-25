import { type JSX, useMemo } from 'react';

import type { Run } from '@shared/ipc/channels/lab';

import { useNow } from '../../lib/use-now';
import { Badge, type BadgeTone } from '../../ui/Badge';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { MetricChart } from './MetricChart';
import { chartGroups, flattenConfig, formatDuration } from './runs-model';
import { STATUS_LABEL } from './RunStatusDot';
import { useRunDetail, useRunMetrics } from './use-runs';

const STATUS_TONE: Record<Run['status'], BadgeTone> = {
	running: 'accent',
	finished: 'up',
	failed: 'down',
	interrupted: 'warn',
};

/** Mount with `key={run.id}`: the metric stream is per run. */
export function RunView({ run }: { run: Run }): JSX.Element {
	const live = run.status === 'running';
	const now = useNow(1_000);
	const detail = useRunDetail(run.id, live);
	const { series, loaded, error } = useRunMetrics(run.id, live);
	const groups = useMemo(() => chartGroups(Object.keys(series)), [series]);
	const config = useMemo(() => (detail ? flattenConfig(detail.config) : []), [detail]);
	const end = live ? now : (run.endedAt ?? run.updatedAt);

	let charts: JSX.Element;
	if (error && !loaded) {
		charts = <ErrorState title='Metrics unavailable' message={error.message} />;
	} else if (!loaded) {
		charts = (
			<div className='flex h-40 items-center justify-center'>
				<Spinner label='Loading metrics' />
			</div>
		);
	} else if (groups.length === 0) {
		charts = (
			<p className='px-1 py-6 text-center text-12 text-fg-2'>
				{live ? 'Waiting for the first probe.log(…)' : 'This run logged no metrics.'}
			</p>
		);
	} else {
		charts = (
			<div className='grid grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-2'>
				{groups.map((g) => (
					<MetricChart key={g.title} title={g.title} keys={g.keys} series={series} />
				))}
			</div>
		);
	}

	return (
		<div className='flex min-h-0 flex-1 flex-col overflow-y-auto p-3' data-run-view={run.id}>
			<header className='mb-3 flex flex-wrap items-center gap-x-3 gap-y-1'>
				<h2 className='text-16 font-semibold text-fg-0'>{run.name}</h2>
				<Badge tone={STATUS_TONE[run.status]}>{STATUS_LABEL[run.status]}</Badge>
				<span className='num text-12 text-fg-2'>
					{new Date(run.startedAt).toLocaleString()} ·{' '}
					{formatDuration(end - run.startedAt)}
					{run.lastStep !== null && ` · step ${run.lastStep}`}
				</span>
				{run.host && (
					<span className='num ml-auto text-11 text-fg-2' title={run.script ?? undefined}>
						{run.host}
						{run.pid !== null && ` · pid ${run.pid}`}
					</span>
				)}
			</header>
			{run.error && (
				<pre className='selectable mb-3 overflow-x-auto rounded-sm border border-down/40 bg-down-soft px-2 py-1.5 text-12 text-down'>
					{run.error}
				</pre>
			)}
			{charts}
			{config.length > 0 && (
				<details className='mt-3 rounded-sm border border-border' open>
					<summary className='cursor-default px-2 py-1 text-12 font-medium text-fg-1 focus-visible:shadow-glow focus-visible:outline-none'>
						Config ({config.length})
					</summary>
					<table className='num w-full text-12'>
						<tbody>
							{config.map(([key, value]) => (
								<tr key={key} className='border-t border-border/60'>
									<td className='w-1/3 px-2 py-1 text-fg-2'>{key}</td>
									<td className='selectable px-2 py-1 break-all text-fg-0'>
										{value}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</details>
			)}
			{run.script && (
				<p className='num mt-2 truncate text-11 text-fg-2' title={run.script}>
					{run.script}
				</p>
			)}
		</div>
	);
}
