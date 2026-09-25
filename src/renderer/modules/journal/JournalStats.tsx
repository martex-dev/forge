import { BarChart3 } from 'lucide-react';
import { type JSX, useMemo } from 'react';

import type { JournalEntry } from '@shared/ipc/channels/journal';

import { cn } from '../../lib/cn';
import { baseOption } from '../../lib/echarts';
import { resolveToken } from '../../lib/resolve-color';
import { EChart } from '../../ui/EChart';
import { EmptyState } from '../../ui/EmptyState';
import { formatMoney, formatR, toneOf } from './EntryMetrics';
import { computeStats, type GroupStats } from './journal-model';

const pct = (v: number | null): string => (v === null ? '—' : `${(v * 100).toFixed(0)}%`);

function Stat({
	label,
	value,
	tone,
}: {
	label: string;
	value: string;
	tone?: string;
}): JSX.Element {
	return (
		<div className='flex flex-col gap-0.5 rounded-sm border border-border bg-bg-2 px-2 py-1.5'>
			<dt className='text-11 text-fg-2'>{label}</dt>
			<dd className={cn('num text-14', tone ?? 'text-fg-0')} data-journal-stat={label}>
				{value}
			</dd>
		</div>
	);
}

function GroupTable({ title, rows }: { title: string; rows: GroupStats[] }): JSX.Element {
	return (
		<section className='min-w-0 flex-1'>
			<h3 className='mb-1 text-12 font-medium text-fg-1'>{title}</h3>
			<table className='num w-full text-12'>
				<thead className='text-11 text-fg-2'>
					<tr>
						<th className='text-left font-normal'>Name</th>
						<th className='text-right font-normal'>Trades</th>
						<th className='text-right font-normal'>Win</th>
						<th className='text-right font-normal'>Net</th>
					</tr>
				</thead>
				<tbody>
					{rows.map((g) => (
						<tr key={g.key} className='border-t border-border/60'>
							<td className='truncate py-0.5 text-fg-0'>{g.key}</td>
							<td className='text-right text-fg-1'>{g.trades}</td>
							<td className='text-right text-fg-1'>{pct(g.winRate)}</td>
							<td className={cn('text-right', toneOf(g.net))}>
								{formatMoney(g.net)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</section>
	);
}

export function JournalStats({ entries }: { entries: JournalEntry[] }): JSX.Element {
	const s = useMemo(() => computeStats(entries), [entries]);
	const option = useMemo(() => {
		const base = baseOption();
		const [up, down] = [resolveToken('--up'), resolveToken('--down')];
		const color = s.net >= 0 ? up : down;
		return {
			...base,
			xAxis: { ...(base['xAxis'] as object), type: 'time' },
			series: [
				{
					type: 'line',
					name: 'Equity',
					data: s.equity,
					step: 'end',
					showSymbol: s.equity.length < 40,
					lineStyle: { width: 1.5, color },
					itemStyle: { color },
					areaStyle: { color, opacity: 0.08 },
				},
			],
		};
	}, [s]);

	if (s.scored === 0) {
		return (
			<EmptyState
				icon={<BarChart3 size={20} />}
				title='No closed trades yet'
				description='Close a trade with entry, exit and size (or a P/L) to see win rate, expectancy and the equity curve.'
			/>
		);
	}
	return (
		<div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3' data-journal-stats>
			<dl className='grid grid-cols-[repeat(auto-fill,minmax(7.5rem,1fr))] gap-2'>
				<Stat label='Net P/L' value={formatMoney(s.net)} tone={toneOf(s.net)} />
				<Stat label='Trades' value={`${s.scored}`} />
				<Stat label='Win rate' value={pct(s.winRate)} />
				<Stat
					label='Profit factor'
					value={s.profitFactor === null ? '—' : s.profitFactor.toFixed(2)}
				/>
				<Stat
					label='Expectancy'
					value={formatMoney(s.expectancy)}
					tone={toneOf(s.expectancy)}
				/>
				<Stat label='Avg R' value={formatR(s.avgR)} tone={toneOf(s.avgR)} />
				<Stat label='Avg win' value={formatMoney(s.avgWin)} tone='text-up' />
				<Stat label='Avg loss' value={formatMoney(s.avgLoss)} tone='text-down' />
				<Stat label='Best' value={formatMoney(s.best)} tone={toneOf(s.best)} />
				<Stat label='Worst' value={formatMoney(s.worst)} tone={toneOf(s.worst)} />
				<Stat
					label='Max drawdown'
					value={formatMoney(-s.maxDrawdown)}
					tone={toneOf(-s.maxDrawdown)}
				/>
			</dl>
			<section className='flex h-56 shrink-0 flex-col rounded-sm border border-border bg-bg-1'>
				<h3 className='border-b border-border px-2 py-1 text-12 font-medium text-fg-0'>
					Equity
				</h3>
				<EChart option={option} notMerge className='flex-1' aria-label='Equity curve' />
			</section>
			{s.closed > s.scored && (
				<p className='text-11 text-fg-2'>
					{s.closed - s.scored} closed trade(s) have no P/L and aren&apos;t counted.
				</p>
			)}
			<div className='flex flex-wrap gap-4'>
				<GroupTable title='By setup' rows={s.bySetup} />
				<GroupTable title='By symbol' rows={s.bySymbol} />
			</div>
		</div>
	);
}
