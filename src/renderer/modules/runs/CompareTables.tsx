import { type JSX, useState } from 'react';

import type { Run, RunDetail, RunSummary } from '@shared/ipc/channels/lab';

import { cn } from '../../lib/cn';
import { Switch } from '../../ui/Switch';
import { bestIndex, configDiff, metricDirection } from './compare-model';
import { formatDuration, formatMetric } from './runs-model';

function RunHeader({ runs, colors }: { runs: Run[]; colors: string[] }): JSX.Element {
	return (
		<thead className='sticky top-0 bg-bg-2 text-11 text-fg-2'>
			<tr>
				<th className='px-2 py-1 text-left font-normal'>&nbsp;</th>
				{runs.map((r, i) => (
					<th
						key={r.id}
						className='max-w-40 truncate px-2 py-1 text-right font-normal'
						title={r.name}
					>
						<span
							className='mr-1 inline-block size-2 rounded-full'
							style={{ backgroundColor: colors[i] }}
						/>
						<span className='text-fg-0'>{r.name}</span>
					</th>
				))}
			</tr>
		</thead>
	);
}

/** Final value per metric (min/max below), best run per row highlighted when the direction is known. */
export function SummaryTable({
	runs,
	colors,
	keys,
	summaries,
}: {
	runs: Run[];
	colors: string[];
	keys: string[];
	summaries: RunSummary[];
}): JSX.Element {
	const byId = new Map(summaries.map((s) => [s.id, s]));
	return (
		<section aria-label='Summary'>
			<h3 className='mb-1 text-12 font-medium text-fg-1'>Summary</h3>
			<table className='num w-full text-12' data-compare-summary>
				<RunHeader runs={runs} colors={colors} />
				<tbody>
					<tr className='border-t border-border/60'>
						<td className='px-2 py-1 font-sans text-fg-2'>steps · time</td>
						{runs.map((r) => (
							<td key={r.id} className='px-2 py-1 text-right text-fg-1'>
								{r.lastStep ?? '—'} ·{' '}
								{formatDuration((r.endedAt ?? r.updatedAt) - r.startedAt)}
							</td>
						))}
					</tr>
					{keys.map((key) => {
						const direction = metricDirection(key);
						const finals = runs.map((r) => byId.get(r.id)?.metrics[key]?.last ?? null);
						const best = bestIndex(finals, direction);
						return (
							<tr
								key={key}
								className='border-t border-border/60'
								data-compare-metric={key}
							>
								<td className='px-2 py-1 font-sans text-fg-0'>
									{key}
									{direction && (
										<span className='ml-1 text-11 text-fg-2'>
											{direction === 'min' ? '↓ better' : '↑ better'}
										</span>
									)}
								</td>
								{runs.map((r, i) => {
									const m = byId.get(r.id)?.metrics[key];
									return (
										<td
											key={r.id}
											className={cn(
												'px-2 py-1 text-right',
												best === i ? 'bg-up-soft text-up' : 'text-fg-0',
											)}
											data-best={best === i || undefined}
										>
											{m ? formatMetric(m.last) : '—'}
											{m && (
												<span className='block text-11 text-fg-2'>
													{formatMetric(m.min)} … {formatMetric(m.max)}
												</span>
											)}
										</td>
									);
								})}
							</tr>
						);
					})}
				</tbody>
			</table>
		</section>
	);
}

export function ConfigTable({
	runs,
	colors,
	details,
}: {
	runs: Run[];
	colors: string[];
	details: Array<RunDetail | undefined>;
}): JSX.Element {
	const [onlyDiff, setOnlyDiff] = useState(true);
	const rows = configDiff(details.map((d) => d?.config ?? {}));
	const shown = onlyDiff ? rows.filter((r) => r.differs) : rows;
	return (
		<section aria-label='Config'>
			<div className='mb-1 flex items-center gap-2'>
				<h3 className='text-12 font-medium text-fg-1'>Config</h3>
				<label className='ml-auto flex items-center gap-2 text-11 text-fg-2'>
					<Switch
						checked={onlyDiff}
						onCheckedChange={setOnlyDiff}
						aria-label='Only differences'
					/>
					Only differences ({rows.filter((r) => r.differs).length} of {rows.length})
				</label>
			</div>
			{shown.length === 0 ? (
				<p className='text-12 text-fg-2'>
					{rows.length === 0 ? 'These runs logged no config.' : 'Identical configs.'}
				</p>
			) : (
				<table className='num w-full text-12' data-compare-config>
					<RunHeader runs={runs} colors={colors} />
					<tbody>
						{shown.map((row) => (
							<tr key={row.key} className='border-t border-border/60'>
								<td
									className={cn(
										'px-2 py-1 font-sans',
										row.differs ? 'text-accent' : 'text-fg-1',
									)}
								>
									{row.key}
								</td>
								{row.values.map((v, i) => (
									<td
										key={runs[i]?.id ?? i}
										className='max-w-48 truncate px-2 py-1 text-right text-fg-0'
										title={v}
									>
										{v ?? <span className='text-fg-2'>—</span>}
									</td>
								))}
							</tr>
						))}
					</tbody>
				</table>
			)}
		</section>
	);
}
