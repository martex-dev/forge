import { Bell, BookOpenText, CalendarClock, Presentation } from 'lucide-react';
import type { JSX } from 'react';

import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { earningsToday, etWeek, journalToday, macroToday, todayEt } from './today-model';
import { Muted, TodayCard } from './TodayCard';
import { useSource } from './use-today';

const time = new Intl.DateTimeFormat(undefined, {
	hour: '2-digit',
	minute: '2-digit',
	hour12: false,
});
const money = (v: number): string =>
	`${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;
const IMPACT_DOT = { high: 'bg-down', medium: 'bg-warn', low: 'bg-accent-hub' } as const;

function countdown(ms: number): string {
	const m = Math.max(0, Math.round(ms / 60_000));
	return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
}

export function MacroCard({ enabled, now }: { enabled: boolean; now: number }): JSX.Element | null {
	const week = useSource<'calendar:week'>(
		['calendar', 'week'],
		enabled,
		() => call('calendar:week'),
		true,
	);
	if (!enabled) return null;
	const { events, next } = macroToday(week.data?.events ?? [], now);
	return (
		<TodayCard
			title='Macro today'
			icon={CalendarClock}
			panelId='calendar.week'
			query={week}
			accent={
				next ? (
					<span className='text-accent'>in {countdown(next.time - now)}</span>
				) : undefined
			}
		>
			{events.length === 0 ? (
				<Muted>No high or medium-impact events today.</Muted>
			) : (
				<ul className='flex flex-col gap-1'>
					{events.slice(0, 7).map((e) => (
						<li
							key={e.id}
							className={cn('flex items-center gap-2', e.time < now && 'opacity-45')}
						>
							<span className='num w-10 text-fg-1'>{time.format(e.time)}</span>
							<span
								className={cn(
									'size-1.5 rounded-full',
									IMPACT_DOT[e.impact === 'high' ? 'high' : 'medium'],
								)}
							/>
							<span className='num w-8 text-fg-0'>{e.currency}</span>
							<span
								className={cn(
									'truncate',
									e.id === next?.id ? 'text-accent' : 'text-fg-0',
								)}
							>
								{e.title}
							</span>
						</li>
					))}
				</ul>
			)}
		</TodayCard>
	);
}

export function EarningsCard({
	enabled,
	now,
}: {
	enabled: boolean;
	now: number;
}): JSX.Element | null {
	const today = todayEt(now);
	const range = etWeek(today);
	const earnings = useSource<'earnings:range'>(
		['earnings', 'today', range.start],
		enabled,
		() => call('earnings:range', range),
		true,
	);
	if (!enabled) return null;
	const list = earningsToday(earnings.data?.events ?? [], today);
	return (
		<TodayCard
			title='Earnings today'
			icon={Presentation}
			panelId='earnings.panel'
			query={earnings}
			accent={list.length || undefined}
		>
			{list.length === 0 ? (
				<Muted>No index earnings today.</Muted>
			) : (
				<ul className='flex flex-col gap-1'>
					{list.slice(0, 7).map((e) => (
						<li key={e.id} className='flex items-center gap-2'>
							<span className='num w-9 text-11 text-fg-2'>
								{
									{
										premarket: 'BMO',
										afterhours: 'AMC',
										intraday: 'DMH',
										unspecified: '—',
									}[e.session]
								}
							</span>
							<span className={cn('size-1.5 rounded-full', IMPACT_DOT[e.impact])} />
							<span className='num w-14 font-medium text-fg-0'>{e.symbol}</span>
							<span className='truncate text-fg-1'>{e.name}</span>
						</li>
					))}
					{list.length > 7 && (
						<li className='text-11 text-fg-2'>+{list.length - 7} more</li>
					)}
				</ul>
			)}
		</TodayCard>
	);
}

export function JournalCard({
	enabled,
	now,
}: {
	enabled: boolean;
	now: number;
}): JSX.Element | null {
	const journal = useSource<'journal:list'>(['journal', 'entries'], enabled, () =>
		call('journal:list'),
	);
	if (!enabled) return null;
	const s = journalToday(journal.data ?? [], now);
	return (
		<TodayCard
			title='Trading today'
			icon={BookOpenText}
			panelId='journal.panel'
			query={journal}
			accent={
				s.trades ? (
					<span className={s.pnl >= 0 ? 'text-up' : 'text-down'}>{money(s.pnl)}</span>
				) : undefined
			}
		>
			{s.trades === 0 && s.open === 0 ? (
				<Muted>No trades logged today.</Muted>
			) : (
				<dl className='num grid grid-cols-3 gap-2'>
					<div>
						<dt className='font-sans text-11 text-fg-2'>Closed</dt>
						<dd className='text-14 text-fg-0'>{s.trades}</dd>
					</div>
					<div>
						<dt className='font-sans text-11 text-fg-2'>Wins</dt>
						<dd className='text-14 text-fg-0'>{s.wins}</dd>
					</div>
					<div>
						<dt className='font-sans text-11 text-fg-2'>Open</dt>
						<dd className='text-14 text-fg-0'>{s.open}</dd>
					</div>
				</dl>
			)}
		</TodayCard>
	);
}

export function AlertsCard({
	enabled,
	now,
}: {
	enabled: boolean;
	now: number;
}): JSX.Element | null {
	const alerts = useSource<'alerts:list'>(['alerts', 'list'], enabled, () => call('alerts:list'));
	if (!enabled) return null;
	const list = alerts.data ?? [];
	const since = new Date(now).setHours(0, 0, 0, 0);
	const fired = list.filter((a) => (a.lastFiredAt ?? 0) >= since);
	return (
		<TodayCard
			title='Alerts'
			icon={Bell}
			panelId='alerts.panel'
			query={alerts}
			accent={`${list.filter((a) => a.enabled).length} armed`}
		>
			{fired.length === 0 ? (
				<Muted>{list.length ? 'Nothing fired today.' : 'No alerts set.'}</Muted>
			) : (
				<ul className='flex flex-col gap-1'>
					{fired.map((a) => (
						<li key={a.id} className='flex gap-2'>
							<span className='num w-10 text-fg-1'>
								{time.format(a.lastFiredAt ?? 0)}
							</span>
							<span className='truncate text-fg-0'>
								{a.kind === 'price'
									? `${a.source.kind === 'binance' ? a.source.symbol : a.source.label} ${a.op} ${a.value}`
									: `${a.minutesBefore} min before ${a.impacts.join('/')} events`}
							</span>
						</li>
					))}
				</ul>
			)}
		</TodayCard>
	);
}
