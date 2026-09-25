import { useQuery } from '@tanstack/react-query';
import { ExternalLink, RefreshCw } from 'lucide-react';
import { type JSX, useState } from 'react';

import { SIDECAR_META } from '../../app/hooks/use-sidecar-recovery';
import { cn } from '../../lib/cn';
import { formatAge, formatPrice, formatUsdCompact } from '../../lib/format';
import { call } from '../../lib/ipc';
import { useNow } from '../../lib/use-now';
import { toast } from '../../stores/toast-store';
import { useUiStore } from '../../stores/ui-store';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';

const SHOWN = 30;

function openExternal(url: string): void {
	call('app:openExternal', url).catch(() => toast.error('Could not open link'));
}

const amount = (n: number): string =>
	n >= 1_000_000
		? `${(n / 1_000_000).toFixed(2)}M`
		: n >= 1_000
			? `${(n / 1_000).toFixed(1)}K`
			: n.toPrecision(4).replace(/\.?0+$/, '');

export function SnapshotView({ address }: { address: string }): JSX.Element {
	const visible = useUiStore((s) => s.room === 'trade');
	const now = useNow(60_000);
	const [all, setAll] = useState(false);
	const q = useQuery({
		queryKey: ['solana', 'snapshot', address],
		queryFn: () => call('solana:snapshot', { address, refresh: false }),
		meta: SIDECAR_META,
		refetchInterval: visible ? 60_000 : false,
		retry: false,
	});
	const refresh = (): void => {
		void call('solana:snapshot', { address, refresh: true })
			.then(() => q.refetch())
			.catch((e: unknown) =>
				toast.error('Refresh failed', e instanceof Error ? e.message : String(e)),
			);
	};

	if (q.isLoading) {
		return (
			<div className='flex h-24 items-center justify-center'>
				<Spinner label='Reading wallet' />
			</div>
		);
	}
	if (q.error || !q.data) {
		return (
			<ErrorState
				title='Wallet unavailable'
				message={q.error?.message ?? 'No data'}
				onRetry={() => void q.refetch()}
			/>
		);
	}
	const s = q.data;
	const holdings = all ? s.holdings : s.holdings.slice(0, SHOWN);
	return (
		<div className='flex flex-col' data-wallet-snapshot={address}>
			<div className='flex items-end gap-3 border-b border-border px-3 py-2'>
				<div>
					<div className='text-11 text-fg-2'>Total value</div>
					<div className='num text-20 font-semibold text-fg-0'>
						{formatUsdCompact(s.totalUsd)}
					</div>
				</div>
				<div className='num pb-0.5 text-12 text-fg-1'>
					{amount(s.sol)} SOL{' '}
					<span className='text-fg-2'>@ {formatPrice(s.solPriceUsd)}</span>
				</div>
				<span className='num ml-auto pb-0.5 text-11 text-fg-2'>
					updated {formatAge(s.fetchedAt, now)} ago
				</span>
				<IconButton
					label='Refresh now'
					size='sm'
					icon={<RefreshCw size={12} />}
					onClick={refresh}
				/>
			</div>
			<table className='num w-full text-12' aria-label='Token holdings'>
				<tbody>
					{holdings.map((h) => (
						<tr
							key={h.mint}
							className='border-b border-border/60'
							data-holding={h.symbol ?? h.mint}
						>
							<td className='w-6 py-1 pl-3'>
								{h.imageUrl ? (
									<img
										src={h.imageUrl}
										alt=''
										className='size-4 rounded-full'
										referrerPolicy='no-referrer'
									/>
								) : (
									<span className='block size-4 rounded-full bg-bg-3' />
								)}
							</td>
							<td className='truncate text-fg-0' title={h.name ?? h.mint}>
								{h.symbol ?? `${h.mint.slice(0, 4)}…`}
							</td>
							<td className='text-right text-fg-1'>{amount(h.amount)}</td>
							<td className='text-right text-fg-2'>{formatPrice(h.priceUsd)}</td>
							<td className='pr-3 text-right text-fg-0'>
								{formatUsdCompact(h.valueUsd)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
			{s.holdings.length > SHOWN && (
				<button
					type='button'
					onClick={() => setAll(!all)}
					className='px-3 py-1 text-left text-11 text-accent hover:underline'
				>
					{all ? 'Show fewer' : `Show all ${s.holdings.length} tokens`}
				</button>
			)}
			<h3 className='border-b border-border px-3 pt-3 pb-1 text-11 font-medium tracking-wide text-fg-2 uppercase'>
				Recent transactions
			</h3>
			<ul aria-label='Recent transactions'>
				{s.transactions.slice(0, 10).map((t) => (
					<li key={t.signature}>
						<button
							type='button'
							onClick={() => openExternal(`https://solscan.io/tx/${t.signature}`)}
							className='flex w-full items-center gap-2 border-b border-border/60 px-3 py-1 text-left text-12 hover:bg-bg-2 focus-visible:shadow-glow focus-visible:outline-none'
						>
							<span
								className={cn(
									'size-1.5 shrink-0 rounded-full',
									t.ok ? 'bg-up' : 'bg-down',
								)}
								aria-label={t.ok ? 'ok' : 'failed'}
							/>
							<span className='num truncate text-fg-1'>
								{t.signature.slice(0, 8)}…{t.signature.slice(-6)}
							</span>
							<span className='num ml-auto shrink-0 text-11 text-fg-2'>
								{t.time ? `${formatAge(t.time, now)} ago` : '—'}
							</span>
							<ExternalLink size={11} className='shrink-0 text-fg-2' />
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
