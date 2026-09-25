import { useQuery } from '@tanstack/react-query';
import { LineChart, RefreshCw } from 'lucide-react';
import { type JSX, useMemo, useState } from 'react';

import type { Mt5Account, Mt5Deal, Mt5Position } from '@shared/ipc/channels/mt5';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { useUiStore } from '../../stores/ui-store';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { floating, money, priceDigits, summarizeHistory } from './mt5-model';

const pnl = (v: number): string => (v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-fg-1');
const when = (t: number): string =>
	new Date(t).toLocaleString('en-GB', {
		day: '2-digit',
		month: 'short',
		hour: '2-digit',
		minute: '2-digit',
	});

function Stat({
	label,
	value,
	className,
}: {
	label: string;
	value: string;
	className?: string;
}): JSX.Element {
	return (
		<div className='flex flex-col'>
			<span className='text-11 text-fg-2'>{label}</span>
			<span className={cn('num text-13 font-semibold text-fg-0', className)}>{value}</span>
		</div>
	);
}

function AccountStrip({ a, positions }: { a: Mt5Account; positions: Mt5Position[] }): JSX.Element {
	const open = floating(positions);
	return (
		<div
			className='flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border px-3 py-2'
			data-mt5-account={a.login}
		>
			<div className='min-w-0'>
				<div className='flex items-center gap-1.5 text-13 text-fg-0'>
					<span className='num'>{a.login}</span>
					<Badge tone={a.mode === 'real' ? 'warn' : 'info'}>{a.mode}</Badge>
				</div>
				<div className='truncate text-11 text-fg-2'>
					{a.server} · 1:{a.leverage}
				</div>
			</div>
			<Stat label='Balance' value={money(a.balance, a.currency)} />
			<Stat label='Equity' value={money(a.equity, a.currency)} />
			<Stat label='Floating P/L' value={money(open, a.currency)} className={pnl(open)} />
			<Stat label='Free margin' value={money(a.marginFree, a.currency)} />
			<Stat
				label='Margin level'
				value={a.marginLevel === null ? '—' : `${a.marginLevel.toFixed(0)}%`}
			/>
		</div>
	);
}

function Positions({
	positions,
	currency,
}: {
	positions: Mt5Position[];
	currency: string;
}): JSX.Element {
	if (positions.length === 0) return <p className='p-3 text-12 text-fg-2'>No open positions.</p>;
	return (
		<table className='num w-full text-12' aria-label='Open positions'>
			<thead className='sticky top-0 bg-bg-1 text-11 text-fg-2'>
				<tr className='border-b border-border text-left'>
					<th className='px-3 py-1 font-normal'>Symbol</th>
					<th className='font-normal'>Side</th>
					<th className='text-right font-normal'>Volume</th>
					<th className='text-right font-normal'>Open</th>
					<th className='text-right font-normal'>Current</th>
					<th className='text-right font-normal'>SL</th>
					<th className='text-right font-normal'>TP</th>
					<th className='px-3 text-right font-normal'>P/L</th>
				</tr>
			</thead>
			<tbody>
				{positions.map((p) => {
					const d = priceDigits(p.priceOpen, p.priceCurrent);
					return (
						<tr
							key={p.ticket}
							className='border-b border-border/60'
							data-mt5-position={p.symbol}
						>
							<td className='px-3 py-1 text-fg-0'>{p.symbol}</td>
							<td className={p.side === 'buy' ? 'text-up' : 'text-down'}>{p.side}</td>
							<td className='text-right'>{p.volume}</td>
							<td className='text-right'>{p.priceOpen.toFixed(d)}</td>
							<td className='text-right text-fg-0'>{p.priceCurrent.toFixed(d)}</td>
							<td className='text-right text-fg-2'>{p.sl?.toFixed(d) ?? '—'}</td>
							<td className='text-right text-fg-2'>{p.tp?.toFixed(d) ?? '—'}</td>
							<td
								className={cn(
									'px-3 text-right font-semibold',
									pnl(p.profit + p.swap),
								)}
							>
								{money(p.profit + p.swap, currency)}
							</td>
						</tr>
					);
				})}
			</tbody>
		</table>
	);
}

function History({ deals, currency }: { deals: Mt5Deal[]; currency: string }): JSX.Element {
	const s = useMemo(() => summarizeHistory(deals), [deals]);
	const trades = deals.filter((d) => d.side === 'buy' || d.side === 'sell');
	return (
		<>
			<div className='flex gap-5 border-b border-border px-3 py-2'>
				<Stat label='Net P/L (30d)' value={money(s.net, currency)} className={pnl(s.net)} />
				<Stat label='Closed trades' value={String(s.closedTrades)} />
				<Stat
					label='Win rate'
					value={s.winRate === null ? '—' : `${s.winRate.toFixed(0)}%`}
				/>
			</div>
			{trades.length === 0 ? (
				<p className='p-3 text-12 text-fg-2'>No trades in the last 30 days.</p>
			) : (
				<table className='num w-full text-12' aria-label='Deal history'>
					<tbody>
						{trades.map((d) => (
							<tr key={d.ticket} className='border-b border-border/60'>
								<td className='px-3 py-1 text-fg-2'>{when(d.time)}</td>
								<td className='text-fg-0'>{d.symbol}</td>
								<td className={d.side === 'buy' ? 'text-up' : 'text-down'}>
									{d.side} {d.entry}
								</td>
								<td className='text-right'>{d.volume}</td>
								<td className='text-right'>{d.price}</td>
								<td className={cn('px-3 text-right', pnl(d.profit))}>
									{d.entry === 'in'
										? ''
										: money(d.profit + d.commission + d.swap, currency)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</>
	);
}

export function Mt5Panel(): JSX.Element {
	const visible = useUiStore((s) => s.room === 'trade');
	const [tab, setTab] = useState<'positions' | 'history'>('positions');
	const status = useQuery({
		queryKey: ['mt5', 'status'],
		queryFn: () => call('mt5:status'),
		meta: SIDECAR_META,
		refetchInterval: visible ? 5_000 : false,
	});
	const connected = Boolean(status.data?.account);
	const positions = useQuery({
		queryKey: ['mt5', 'positions'],
		queryFn: () => call('mt5:positions'),
		enabled: connected,
		meta: SIDECAR_META,
		// Live P/L while on screen; MT5 answers locally in milliseconds.
		refetchInterval: visible ? 2_000 : false,
	});
	const history = useQuery({
		queryKey: ['mt5', 'history', 30],
		queryFn: () => call('mt5:history', { days: 30 }),
		enabled: connected && tab === 'history',
		meta: SIDECAR_META,
		staleTime: 60_000,
	});

	if (status.isLoading) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Connecting to MetaTrader 5' />
			</div>
		);
	}
	if (status.error)
		return (
			<ErrorState
				title='MT5 unavailable'
				message={status.error.message}
				onRetry={() => void status.refetch()}
			/>
		);
	const account = status.data?.account;
	if (!account) {
		return (
			<EmptyState
				icon={<LineChart size={20} />}
				title='MetaTrader 5 not connected'
				description={status.data?.reason ?? 'Start MetaTrader 5 and log in.'}
				action={
					<Button
						size='sm'
						icon={<RefreshCw size={12} />}
						onClick={() => void status.refetch()}
					>
						Check again
					</Button>
				}
			/>
		);
	}
	return (
		<div className='flex h-full flex-col bg-bg-1' data-mt5>
			<AccountStrip a={account} positions={positions.data ?? []} />
			<div role='tablist' aria-label='MT5 views' className='flex border-b border-border'>
				{(['positions', 'history'] as const).map((t) => (
					<button
						key={t}
						type='button'
						role='tab'
						aria-selected={tab === t}
						onClick={() => setTab(t)}
						className={cn(
							'h-7 border-b-2 px-4 text-12 focus-visible:shadow-glow focus-visible:outline-none',
							tab === t
								? 'border-accent text-fg-0'
								: 'border-transparent text-fg-2 hover:text-fg-1',
						)}
					>
						{t === 'positions'
							? `Positions (${positions.data?.length ?? 0})`
							: 'History (30d)'}
					</button>
				))}
				<span className='ml-auto self-center px-3 text-11 text-fg-2'>Read-only</span>
			</div>
			<div className='min-h-0 flex-1 overflow-y-auto'>
				{tab === 'positions' ? (
					positions.error ? (
						<ErrorState
							title='Positions unavailable'
							message={positions.error.message}
						/>
					) : (
						<Positions positions={positions.data ?? []} currency={account.currency} />
					)
				) : history.isLoading ? (
					<div className='flex h-24 items-center justify-center'>
						<Spinner label='Loading history' />
					</div>
				) : history.error ? (
					<ErrorState title='History unavailable' message={history.error.message} />
				) : (
					<History deals={history.data ?? []} currency={account.currency} />
				)}
			</div>
		</div>
	);
}
