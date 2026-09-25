import {
	ChevronLeft,
	ChevronRight,
	Presentation,
	RefreshCw,
	Search,
	Settings2,
} from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import { cn } from '../../lib/cn';
import { useNow } from '../../lib/use-now';
import { useUiStore } from '../../stores/ui-store';
import { Badge } from '../../ui/Badge';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import {
	filterEarnings,
	formatDay,
	groupEarnings,
	type Impact,
	todayEt,
	weekRange,
} from './earnings-model';
import { EarningsList, IMPACT_DOT } from './EarningsList';
import { EarningsSettingsDialog } from './EarningsSettingsDialog';
import { useEarnings, useEarningsSettings } from './use-earnings';

const SOURCE_LABEL = { nasdaq: 'NASDAQ', finnhub: 'Finnhub', 'market-calendar': 'Market Calendar' };
const IMPACTS: Impact[] = ['high', 'medium', 'low'];

export function EarningsPanel({ params, setParams }: PanelProps): JSX.Element {
	const visible = useUiStore((s) => s.room === 'trade');
	const now = useNow(60_000);
	const today = todayEt(now);
	const offset = typeof params['week'] === 'number' ? params['week'] : 0;
	const range = weekRange(today, offset);
	const settings = useEarningsSettings();
	const earnings = useEarnings(range, settings.data, visible);
	const [impacts, setImpacts] = useState<Impact[]>(['high', 'medium', 'low']);
	const [query, setQuery] = useState('');
	const [editing, setEditing] = useState(params['settings'] === true);
	const days = useMemo(
		() => groupEarnings(filterEarnings(earnings.data?.events ?? [], { impacts, query })),
		[earnings.data, impacts, query],
	);
	const data = earnings.data;
	const closeSettings = (open: boolean): void => {
		setEditing(open);
		if (!open && params['settings']) setParams({ settings: undefined });
	};

	return (
		<div className='flex h-full flex-col bg-bg-1' data-earnings>
			<header className='flex flex-wrap items-center gap-1.5 border-b border-border px-2 py-1'>
				<IconButton
					label='Previous week'
					size='sm'
					icon={<ChevronLeft size={13} />}
					onClick={() => setParams({ week: offset - 1 })}
				/>
				<button
					type='button'
					className='num h-6 rounded-sm px-1.5 text-12 text-fg-0 hover:bg-bg-3 focus-visible:shadow-glow focus-visible:outline-none'
					title='Back to this week'
					onClick={() => setParams({ week: 0 })}
					data-earnings-week={range.start}
				>
					{formatDay(range.start)} – {formatDay(range.end)}
					{offset === 0 && <span className='ml-1.5 text-fg-2'>this week</span>}
				</button>
				<IconButton
					label='Next week'
					size='sm'
					icon={<ChevronRight size={13} />}
					onClick={() => setParams({ week: offset + 1 })}
				/>
				<div className='ml-1 flex gap-1' role='group' aria-label='Impact'>
					{IMPACTS.map((i) => (
						<button
							key={i}
							type='button'
							aria-pressed={impacts.includes(i)}
							onClick={() =>
								setImpacts((cur) =>
									cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i],
								)
							}
							className={cn(
								'flex h-5 items-center gap-1 rounded-sm border px-1.5 text-11 focus-visible:shadow-glow focus-visible:outline-none',
								impacts.includes(i)
									? 'border-accent/50 bg-accent-soft text-fg-0'
									: 'border-border text-fg-2 hover:text-fg-1',
							)}
						>
							<span className={cn('size-1.5 rounded-full', IMPACT_DOT[i].dot)} />
							{IMPACT_DOT[i].label}
						</button>
					))}
				</div>
				<Input
					className='h-6 min-w-32 flex-1'
					leading={<Search size={12} />}
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder='Ticker or company'
					aria-label='Filter earnings'
				/>
				{data?.stale && <Badge tone='warn'>Stale</Badge>}
				{settings.data && (
					<span className='text-11 text-fg-2'>{SOURCE_LABEL[settings.data.source]}</span>
				)}
				<IconButton
					label='Refresh'
					size='sm'
					icon={
						<RefreshCw
							size={12}
							className={cn(earnings.isFetching && 'animate-spin')}
						/>
					}
					onClick={() => void earnings.refetch()}
				/>
				<IconButton
					label='Earnings source…'
					size='sm'
					icon={<Settings2 size={12} />}
					onClick={() => setEditing(true)}
				/>
			</header>
			{data && (data.indexFilter === 'unavailable' || data.failedDates.length > 0) && (
				<p className='border-b border-border bg-warn-soft px-3 py-1 text-11 text-warn'>
					{data.indexFilter === 'unavailable' &&
						'Index lists unavailable: showing all companies. '}
					{data.failedDates.length > 0 &&
						`No data for ${data.failedDates.map(formatDay).join(', ')}.`}
				</p>
			)}
			{earnings.isPending || settings.isPending ? (
				<div className='flex flex-1 items-center justify-center'>
					<Spinner label='Loading earnings' />
				</div>
			) : earnings.isError ? (
				<ErrorState
					title='Earnings unavailable'
					message={earnings.error.message}
					onRetry={() => void earnings.refetch()}
					className='flex-1'
				/>
			) : days.length === 0 ? (
				<EmptyState
					icon={<Presentation size={20} />}
					title={data?.events.length ? 'No earnings match' : 'No earnings this week'}
					description={
						data?.events.length
							? 'Loosen the impact filter or the search.'
							: 'Try the next week.'
					}
				/>
			) : (
				<EarningsList days={days} today={today} />
			)}
			{settings.data && editing && (
				<EarningsSettingsDialog
					open
					onOpenChange={closeSettings}
					initial={settings.data}
					hasFinnhubKey={settings.data.hasFinnhubKey}
				/>
			)}
		</div>
	);
}
