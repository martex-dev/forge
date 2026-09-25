import { Copy, ExternalLink } from 'lucide-react';
import type { JSX, ReactNode } from 'react';

import type { PairId } from '@shared/ipc/channels/dex';

import { cn } from '../../lib/cn';
import { formatAge, formatPercent, formatUsdCompact, shortAddress } from '../../lib/format';
import { call } from '../../lib/ipc';
import { useNow } from '../../lib/use-now';
import { toast } from '../../stores/toast-store';
import { Badge } from '../../ui/Badge';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { FlashPrice } from './FlashPrice';
import { usePair, useWatchActions, useWatchlist } from './use-dex';

function Stat({ label, children }: { label: string; children: ReactNode }): JSX.Element {
	return (
		<div className='flex flex-col gap-0.5 rounded-sm border border-border bg-bg-2 px-2 py-1.5'>
			<span className='text-11 text-fg-2'>{label}</span>
			<span className='num text-13 text-fg-0'>{children}</span>
		</div>
	);
}

const pct = (v: number | null): JSX.Element => (
	<span className={cn(v === null ? 'text-fg-2' : v >= 0 ? 'text-up' : 'text-down')}>
		{formatPercent(v)}
	</span>
);

function openExternal(url: string): void {
	call('app:openExternal', url).catch(() => toast.error('Could not open link'));
}

export function PairDetailPanel({ params }: PanelProps): JSX.Element {
	const id: PairId | null =
		typeof params['chainId'] === 'string' && typeof params['pairAddress'] === 'string'
			? { chainId: params['chainId'], pairAddress: params['pairAddress'] }
			: null;
	const { pair, isLoading, error, refetch } = usePair(id);
	const { list } = useWatchlist();
	const { watch, unwatch } = useWatchActions();
	const now = useNow(60_000);

	if (!id)
		return <EmptyState title='No pair selected' description='Click a row in the watchlist.' />;
	if (isLoading) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Loading pair' />
			</div>
		);
	}
	if (error)
		return <ErrorState title='Pair unavailable' message={error.message} onRetry={refetch} />;
	if (!pair)
		return (
			<EmptyState
				title='Pair not found'
				description='DexScreener no longer lists this pair.'
			/>
		);

	const watched = list.some(
		(e) =>
			e.chainId === pair.chainId &&
			e.pairAddress.toLowerCase() === pair.pairAddress.toLowerCase(),
	);
	const buys = pair.txnsH24.buys;
	const sells = pair.txnsH24.sells;
	const buyShare = buys + sells > 0 ? (buys / (buys + sells)) * 100 : 50;

	return (
		<div
			className='h-full overflow-auto bg-bg-1 p-3'
			data-pair-detail={`${pair.chainId}:${pair.pairAddress}`}
		>
			<header className='mb-3 flex items-center gap-3'>
				{pair.imageUrl ? (
					<img
						src={pair.imageUrl}
						alt=''
						className='size-9 rounded-full'
						referrerPolicy='no-referrer'
					/>
				) : (
					<span className='size-9 rounded-full bg-bg-3' />
				)}
				<div className='min-w-0 flex-1'>
					<h2 className='truncate text-16 font-semibold text-fg-0'>
						{pair.base.name}{' '}
						<span className='text-fg-2'>
							({pair.base.symbol}/{pair.quote.symbol})
						</span>
					</h2>
					<div className='flex items-center gap-1.5 text-11 text-fg-2'>
						<Badge>{pair.chainId}</Badge>
						<Badge>{pair.dexId}</Badge>
						{pair.createdAt && <span>age {formatAge(pair.createdAt, now)}</span>}
					</div>
				</div>
				<div className='text-right'>
					<FlashPrice value={pair.priceUsd} className='text-20 font-semibold text-fg-0' />
					<div className='num text-12'>{pct(pair.change.h24)} 24h</div>
				</div>
			</header>

			<div className='mb-3 grid grid-cols-4 gap-2'>
				<Stat label='5m'>{pct(pair.change.m5)}</Stat>
				<Stat label='1h'>{pct(pair.change.h1)}</Stat>
				<Stat label='6h'>{pct(pair.change.h6)}</Stat>
				<Stat label='24h'>{pct(pair.change.h24)}</Stat>
				<Stat label='Liquidity'>{formatUsdCompact(pair.liquidityUsd)}</Stat>
				<Stat label='Volume 24h'>{formatUsdCompact(pair.volume.h24)}</Stat>
				<Stat label='FDV'>{formatUsdCompact(pair.fdv)}</Stat>
				<Stat label='Market cap'>{formatUsdCompact(pair.marketCap)}</Stat>
			</div>

			<div className='mb-3'>
				<div className='mb-1 flex justify-between text-11 text-fg-2'>
					<span className='num text-up'>{buys} buys</span>
					<span>24h transactions</span>
					<span className='num text-down'>{sells} sells</span>
				</div>
				<div className='flex h-1.5 overflow-hidden rounded-full bg-down-soft' aria-hidden>
					<div className='bg-up' style={{ width: `${buyShare}%` }} />
				</div>
			</div>

			<div className='mb-3 flex flex-wrap items-center gap-2 text-12'>
				<span className='text-fg-2'>Token</span>
				<code className='selectable text-fg-1' title={pair.base.address}>
					{shortAddress(pair.base.address)}
				</code>
				<Button
					size='sm'
					variant='ghost'
					icon={<Copy size={12} />}
					onClick={() =>
						void navigator.clipboard
							.writeText(pair.base.address)
							.then(() => toast.success('Address copied'))
					}
				>
					Copy
				</Button>
				<span className='ml-2 text-fg-2'>Pair</span>
				<code className='selectable text-fg-1' title={pair.pairAddress}>
					{shortAddress(pair.pairAddress)}
				</code>
			</div>

			<div className='flex flex-wrap gap-2'>
				<Button
					size='sm'
					variant={watched ? 'secondary' : 'primary'}
					onClick={() => (watched ? unwatch(pair) : watch(pair))}
				>
					{watched ? 'Remove from watchlist' : 'Add to watchlist'}
				</Button>
				<Button
					size='sm'
					icon={<ExternalLink size={12} />}
					onClick={() => openExternal(pair.url)}
				>
					DexScreener
				</Button>
				{pair.links.map((l) => (
					<Button
						key={l.url}
						size='sm'
						variant='ghost'
						icon={<ExternalLink size={12} />}
						onClick={() => openExternal(l.url)}
					>
						{l.label}
					</Button>
				))}
			</div>
		</div>
	);
}
