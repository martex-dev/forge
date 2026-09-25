import { Coins, X } from 'lucide-react';
import type { JSX } from 'react';

import type { DexPair, WatchEntry } from '@shared/ipc/channels/dex';

import { commandContext } from '../../app/commands/use-commands';
import { cn } from '../../lib/cn';
import { formatPercent, formatUsdCompact } from '../../lib/format';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { DexSearch } from './DexSearch';
import { FlashPrice } from './FlashPrice';
import { pairKey, useQuotes, useWatchActions, useWatchlist } from './use-dex';

const change = (v: number | null): JSX.Element => (
	<span
		className={cn(
			'num',
			v === null ? 'text-fg-2' : v > 0 ? 'text-up' : v < 0 ? 'text-down' : 'text-fg-1',
		)}
	>
		{formatPercent(v)}
	</span>
);

export function openPairDetail(entry: {
	chainId: string;
	pairAddress: string;
	symbol: string;
}): void {
	commandContext.openPanel('dexscreener.detail', {
		title: entry.symbol,
		params: { chainId: entry.chainId, pairAddress: entry.pairAddress },
	});
}

function Row({
	entry,
	pair,
	onRemove,
}: {
	entry: WatchEntry;
	pair: DexPair | undefined;
	onRemove: () => void;
}): JSX.Element {
	return (
		<tr
			className='group cursor-default border-b border-border/60 hover:bg-bg-2'
			onClick={() => openPairDetail({ ...entry, symbol: pair?.base.symbol ?? entry.symbol })}
			data-pair={pairKey(entry)}
		>
			<td className='py-1.5 pr-2 pl-3'>
				<div className='flex items-center gap-2'>
					{pair?.imageUrl ? (
						<img
							src={pair.imageUrl}
							alt=''
							className='size-5 rounded-full'
							loading='lazy'
							referrerPolicy='no-referrer'
						/>
					) : (
						<span className='size-5 rounded-full bg-bg-3' />
					)}
					<div className='min-w-0'>
						<div className='truncate text-12 font-medium text-fg-0'>
							{pair?.base.symbol ?? entry.symbol}
							<span className='text-fg-2'>/{pair?.quote.symbol ?? '…'}</span>
						</div>
						<div className='truncate text-11 text-fg-2'>
							{entry.chainId} · {pair?.dexId ?? 'loading'}
						</div>
					</div>
				</div>
			</td>
			<td className='text-right text-12 text-fg-0'>
				<FlashPrice value={pair?.priceUsd ?? null} />
			</td>
			<td className='text-right text-12'>{change(pair?.change.m5 ?? null)}</td>
			<td className='text-right text-12'>{change(pair?.change.h1 ?? null)}</td>
			<td className='text-right text-12'>{change(pair?.change.h24 ?? null)}</td>
			<td className='num text-right text-12 text-fg-1'>
				{formatUsdCompact(pair?.liquidityUsd)}
			</td>
			<td className='num text-right text-12 text-fg-1'>
				{formatUsdCompact(pair?.volume.h24)}
			</td>
			<td className='num pr-1 text-right text-12 text-fg-1'>{formatUsdCompact(pair?.fdv)}</td>
			<td className='w-7 pr-1'>
				<IconButton
					size='sm'
					label={`Remove ${entry.symbol}`}
					icon={<X size={12} />}
					className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
					onClick={(e) => {
						e.stopPropagation();
						onRemove();
					}}
				/>
			</td>
		</tr>
	);
}

export function WatchlistPanel(): JSX.Element {
	const { list, isLoading, error } = useWatchlist();
	const quotes = useQuotes(list.length > 0);
	const { watch, unwatch } = useWatchActions();
	const watched = new Set(list.map(pairKey));

	return (
		<div className='flex h-full flex-col bg-bg-1'>
			<div className='shrink-0 border-b border-border p-2'>
				<DexSearch onPick={watch} isWatched={(p) => watched.has(pairKey(p))} />
			</div>
			<div className='min-h-0 flex-1 overflow-auto'>
				{isLoading ? (
					<div className='flex h-24 items-center justify-center'>
						<Spinner />
					</div>
				) : error ? (
					<ErrorState message={error.message} />
				) : list.length === 0 ? (
					<EmptyState
						icon={<Coins size={22} />}
						title='Watchlist is empty'
						description='Search above for a token (e.g. BONK, WIF) or paste a token/pair address.'
					/>
				) : (
					<>
						{quotes.error && (
							<p
								className='border-b border-border bg-down-soft px-3 py-1 text-11 text-down'
								role='alert'
							>
								{quotes.error.message} — showing last prices.
							</p>
						)}
						<table className='w-full border-collapse' aria-label='Watchlist'>
							<thead className='sticky top-0 z-[1] bg-bg-0 text-11 text-fg-2'>
								<tr className='[&>th]:py-1 [&>th]:font-medium'>
									<th className='pl-3 text-left'>Pair</th>
									<th className='text-right'>Price</th>
									<th className='text-right'>5m</th>
									<th className='text-right'>1h</th>
									<th className='text-right'>24h</th>
									<th className='text-right'>Liq</th>
									<th className='text-right'>Vol 24h</th>
									<th className='pr-1 text-right'>FDV</th>
									<th />
								</tr>
							</thead>
							<tbody>
								{list.map((entry) => (
									<Row
										key={pairKey(entry)}
										entry={entry}
										pair={quotes.quotes.get(pairKey(entry))}
										onRemove={() => unwatch(entry)}
									/>
								))}
							</tbody>
						</table>
					</>
				)}
			</div>
		</div>
	);
}
