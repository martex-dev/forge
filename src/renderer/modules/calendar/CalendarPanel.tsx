import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Clock, RefreshCw } from 'lucide-react';
import { type JSX, useEffect, useMemo, useRef, useState } from 'react';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { useNow } from '../../lib/use-now';
import { Badge } from '../../ui/Badge';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import {
	applyFilters,
	type CalendarFilters,
	currenciesIn,
	DEFAULT_FILTERS,
	formatCountdown,
	groupByDay,
	isImminent,
	nextEvent,
} from './calendar-model';
import { CalendarFilterBar, IMPACT_STYLE } from './CalendarFilterBar';

const FILTERS_KEY = 'forge.calendar.filters';

function loadFilters(): CalendarFilters {
	try {
		const raw = localStorage.getItem(FILTERS_KEY);
		const parsed = raw ? (JSON.parse(raw) as Partial<CalendarFilters>) : null;
		if (parsed && Array.isArray(parsed.impacts) && Array.isArray(parsed.currencies)) {
			return { impacts: parsed.impacts, currencies: parsed.currencies } as CalendarFilters;
		}
	} catch {
		// Unavailable or corrupt storage: defaults are fine.
	}
	return DEFAULT_FILTERS;
}

const timeFmt = new Intl.DateTimeFormat(undefined, {
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});

export function CalendarPanel(): JSX.Element {
	const now = useNow(1000);
	const [filters, setFilters] = useState(loadFilters);
	const listRef = useRef<HTMLDivElement>(null);
	const week = useQuery({
		queryKey: ['calendar', 'week'],
		queryFn: () => call('calendar:week'),
		meta: SIDECAR_META,
		// The sidecar caches for 30 min; every 10 picks up fresh numbers soon enough. While in
		// an error state (rate limit, offline) check again every minute.
		refetchInterval: (q) => (q.state.status === 'error' ? 60_000 : 10 * 60 * 1000),
		staleTime: 5 * 60 * 1000,
	});

	const update = (next: CalendarFilters): void => {
		setFilters(next);
		try {
			localStorage.setItem(FILTERS_KEY, JSON.stringify(next));
		} catch {
			// Non-critical.
		}
	};

	const events = useMemo(() => week.data?.events ?? [], [week.data]);
	const visible = useMemo(() => applyFilters(events, filters), [events, filters]);
	const days = useMemo(() => groupByDay(visible), [visible]);
	const nextHigh = nextEvent(events, now, 'high');

	// Bring the next upcoming event into view once data arrives.
	const scrolled = useRef(false);
	useEffect(() => {
		if (scrolled.current || visible.length === 0) return;
		const upcoming = visible.find((e) => e.time > Date.now());
		if (!upcoming) return;
		scrolled.current = true;
		listRef.current
			?.querySelector(`[data-event-id="${upcoming.id}"]`)
			?.scrollIntoView({ block: 'center' });
	}, [visible]);

	if (week.isLoading) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Loading calendar' />
			</div>
		);
	}
	if (week.error) {
		return (
			<ErrorState
				title='Calendar unavailable'
				message={week.error.message}
				onRetry={() => void week.refetch()}
			/>
		);
	}

	return (
		<div className='flex h-full flex-col bg-bg-1'>
			<div className='flex h-9 shrink-0 items-center gap-2 border-b border-border px-2'>
				<Clock size={13} className='text-accent' />
				{nextHigh ? (
					<span
						className='min-w-0 flex-1 truncate text-12 text-fg-1'
						data-next-high={nextHigh.id}
					>
						Next high impact{' '}
						<span className='num text-14 font-semibold text-accent'>
							{formatCountdown(nextHigh.time - now)}
						</span>{' '}
						<span className='text-fg-0'>
							{nextHigh.currency} · {nextHigh.title}
						</span>
					</span>
				) : (
					<span className='flex-1 text-12 text-fg-2'>
						No more high-impact events this week
					</span>
				)}
				{week.data?.stale && (
					<Badge tone='warn'>
						Stale · {new Date(week.data.fetchedAt).toLocaleTimeString()}
					</Badge>
				)}
				<IconButton
					size='sm'
					label='Refresh'
					icon={<RefreshCw size={13} />}
					onClick={() => void week.refetch()}
				/>
			</div>
			<CalendarFilterBar
				filters={filters}
				currencies={currenciesIn(events)}
				onChange={update}
			/>
			<div
				ref={listRef}
				className='min-h-0 flex-1 overflow-auto'
				role='list'
				aria-label='Economic events'
			>
				{days.length === 0 ? (
					<EmptyState
						icon={<CalendarDays size={22} />}
						title='No events match'
						description='Loosen the impact or currency filters.'
					/>
				) : (
					days.map((day) => (
						<section key={day.key} aria-label={day.label}>
							<h3 className='sticky top-0 z-[1] border-b border-border bg-bg-0 px-3 py-1 text-11 font-medium tracking-widest text-fg-2 uppercase'>
								{day.label}
							</h3>
							{day.events.map((e) => {
								const past = e.time < now;
								const soon = isImminent(e, now);
								return (
									<div
										key={e.id}
										role='listitem'
										data-event-id={e.id}
										data-imminent={soon || undefined}
										className={cn(
											'grid grid-cols-[3.25rem_2.75rem_0.75rem_1fr_4.5rem_4.5rem] items-center gap-2 border-b border-border/60 px-3 py-1.5 text-12',
											soon && 'bg-accent-soft',
											past && 'opacity-45',
										)}
									>
										<span className='num text-fg-1'>
											{timeFmt.format(e.time)}
										</span>
										<span className='num font-medium text-fg-0'>
											{e.currency}
										</span>
										<span
											className={cn(
												'size-2 rounded-full',
												IMPACT_STYLE[e.impact].dot,
											)}
											title={`${IMPACT_STYLE[e.impact].label} impact`}
										/>
										<span className='truncate text-fg-0' title={e.title}>
											{e.title}
											{soon && (
												<span className='num ml-2 text-11 text-accent'>
													in {formatCountdown(e.time - now)}
												</span>
											)}
										</span>
										<span
											className='num truncate text-right text-fg-1'
											title='Forecast'
										>
											{e.forecast ?? '—'}
										</span>
										<span
											className='num truncate text-right text-fg-2'
											title='Previous'
										>
											{e.previous ?? '—'}
										</span>
									</div>
								);
							})}
						</section>
					))
				)}
			</div>
		</div>
	);
}
