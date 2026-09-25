import { NotebookPen } from 'lucide-react';
import type { JSX } from 'react';

import type { EarningsEvent } from '@shared/ipc/channels/earnings';

import { commandContext } from '../../app/commands/use-commands';
import { cn } from '../../lib/cn';
import { IconButton } from '../../ui/IconButton';
import { type EarningsDay, formatCap, type Impact, SESSION_LABEL } from './earnings-model';

const GRID =
	'grid grid-cols-[2.5rem_4.5rem_0.5rem_1fr_4.5rem] items-center gap-2 px-3 @lg:grid-cols-[2.5rem_4.5rem_0.5rem_1fr_4.5rem_6.5rem_4rem_1.5rem]';

export const IMPACT_DOT: Record<Impact, { label: string; dot: string }> = {
	high: { label: 'High', dot: 'bg-down' },
	medium: { label: 'Medium', dot: 'bg-warn' },
	low: { label: 'Low', dot: 'bg-accent-hub' },
};

const money = (text: string | null): number | null => {
	const n = Number((text ?? '').replace(/[$,]/g, ''));
	return text && Number.isFinite(n) ? n : null;
};

/** Green for a beat, red for a miss against the estimate. */
function beatTone(e: EarningsEvent): string {
	const actual = money(e.epsActual);
	const est = money(e.epsForecast);
	if (actual === null || est === null || actual === est) return 'text-fg-0';
	return actual > est ? 'text-up' : 'text-down';
}

/** A pre-earnings plan in the Trade Journal, as an idea (not a trade). */
function journalIdea(e: EarningsEvent): void {
	const when = `${e.date} ${SESSION_LABEL[e.session].long.toLowerCase()}`;
	commandContext.openPanel('journal.panel', {
		params: {
			editing: crypto.randomUUID(),
			draft: {
				symbol: e.symbol,
				market: 'stocks',
				status: 'idea',
				notes: `Earnings ${when}.${e.epsForecast ? ` EPS est. ${e.epsForecast}.` : ''}\n\n`,
			},
		},
	});
}

function Row({ e, past }: { e: EarningsEvent; past: boolean }): JSX.Element {
	const session = SESSION_LABEL[e.session];
	return (
		<div
			role='listitem'
			data-earnings-symbol={e.symbol}
			className={cn(
				GRID,
				'group border-b border-border/60 py-1 text-12',
				past && 'opacity-50',
			)}
		>
			<span className='num text-11 text-fg-2' title={session.long}>
				{session.short}
			</span>
			<span className='num font-medium text-fg-0'>{e.symbol}</span>
			<span
				className={cn('size-2 rounded-full', IMPACT_DOT[e.impact].dot)}
				title={`${IMPACT_DOT[e.impact].label} impact`}
			/>
			<span className='truncate text-fg-1' title={e.name ?? e.symbol}>
				{e.name ?? '—'}
			</span>
			<span className='num truncate text-right text-fg-0' title='EPS estimate'>
				{e.epsForecast ?? '—'}
			</span>
			{e.epsActual ? (
				<span
					className={cn('num hidden truncate text-right @lg:block', beatTone(e))}
					title='Reported EPS'
				>
					{e.epsActual}
				</span>
			) : (
				<span
					className='num hidden truncate text-right text-fg-2 @lg:block'
					title='Year-ago EPS'
				>
					{e.epsPrevious ?? '—'}
				</span>
			)}
			<span className='num hidden text-right text-fg-2 @lg:block' title='Market cap'>
				{formatCap(e.marketCap)}
			</span>
			<IconButton
				label={`Journal idea for ${e.symbol}`}
				size='sm'
				icon={<NotebookPen size={11} />}
				className='hidden opacity-0 group-hover:opacity-100 focus-visible:opacity-100 @lg:inline-flex'
				onClick={() => journalIdea(e)}
			/>
		</div>
	);
}

export function EarningsList({ days, today }: { days: EarningsDay[]; today: string }): JSX.Element {
	return (
		<div className='@container min-h-0 flex-1 overflow-auto' role='list' aria-label='Earnings'>
			<div
				aria-hidden
				className={cn(GRID, 'border-b border-border py-0.5 text-11 text-fg-2')}
			>
				<span>When</span>
				<span>Ticker</span>
				<span />
				<span>Company</span>
				<span className='text-right'>EPS est.</span>
				<span
					className='hidden text-right @lg:block'
					title='Reported EPS, or year-ago EPS before the report'
				>
					Actual / yr ago
				</span>
				<span className='hidden text-right @lg:block'>Cap</span>
			</div>
			{days.map((day) => (
				<section key={day.date} aria-label={day.label}>
					<h3
						className={cn(
							'sticky top-0 z-[1] flex items-center gap-2 border-b border-border bg-bg-0 px-3 py-1 text-11 font-medium tracking-widest uppercase',
							day.date === today ? 'text-accent' : 'text-fg-2',
						)}
					>
						{day.label}
						{day.date === today && (
							<span className='tracking-normal normal-case'>today</span>
						)}
						<span className='ml-auto tracking-normal text-fg-2'>
							{day.events.length}
						</span>
					</h3>
					{day.events.map((e) => (
						<Row key={e.id} e={e} past={day.date < today} />
					))}
				</section>
			))}
		</div>
	);
}
