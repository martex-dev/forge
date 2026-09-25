import { Plus, Search } from 'lucide-react';
import { type JSX, useEffect, useState } from 'react';

import type { DexPair } from '@shared/ipc/channels/dex';

import { formatPrice, formatUsdCompact } from '../../lib/format';
import { Badge } from '../../ui/Badge';
import { Input } from '../../ui/Input';
import { Spinner } from '../../ui/Spinner';
import { useDexSearch } from './use-dex';

interface DexSearchProps {
	onPick: (pair: DexPair) => void;
	isWatched: (pair: DexPair) => boolean;
}

/** Search by name, symbol, token or pair address; results sorted by liquidity. */
export function DexSearch({ onPick, isWatched }: DexSearchProps): JSX.Element {
	const [text, setText] = useState('');
	const [query, setQuery] = useState('');
	const [open, setOpen] = useState(false);

	// Debounce so typing "bonk" is one request, not four.
	useEffect(() => {
		const id = setTimeout(() => setQuery(text.trim()), 350);
		return () => clearTimeout(id);
	}, [text]);

	const { results, isFetching, error } = useDexSearch(query);
	const showResults = open && query.length >= 2;

	return (
		<div className='relative'>
			<Input
				value={text}
				onChange={(e) => {
					setText(e.target.value);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				onBlur={() => setTimeout(() => setOpen(false), 150)}
				onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
				placeholder='Add token: name, symbol or address'
				aria-label='Search DexScreener'
				leading={isFetching ? <Spinner size={12} /> : <Search size={12} />}
			/>
			{showResults && (
				<div
					className='absolute top-8 right-0 left-0 z-30 max-h-80 overflow-auto rounded-sm border border-border-strong bg-bg-2 shadow-xl'
					role='listbox'
					aria-label='Search results'
				>
					{error && <p className='px-3 py-2 text-12 text-down'>{error.message}</p>}
					{!error && !isFetching && results.length === 0 && (
						<p className='px-3 py-2 text-12 text-fg-2'>No pairs found.</p>
					)}
					{results.map((p) => {
						const watched = isWatched(p);
						return (
							<button
								key={`${p.chainId}:${p.pairAddress}`}
								type='button'
								role='option'
								aria-selected={false}
								disabled={watched}
								onMouseDown={(e) => e.preventDefault()}
								onClick={() => {
									onPick(p);
									setText('');
									setOpen(false);
								}}
								className='flex w-full items-center gap-2 px-2 py-1.5 text-left text-12 hover:bg-bg-3 disabled:opacity-50'
							>
								<span className='min-w-0 flex-1 truncate'>
									<span className='font-medium text-fg-0'>{p.base.symbol}</span>
									<span className='text-fg-2'>/{p.quote.symbol}</span>
									<span className='ml-2 text-fg-2'>{p.base.name}</span>
								</span>
								<Badge>{p.chainId}</Badge>
								<span className='num w-20 text-right text-fg-1'>
									${formatPrice(p.priceUsd)}
								</span>
								<span className='num w-16 text-right text-fg-2' title='Liquidity'>
									{formatUsdCompact(p.liquidityUsd)}
								</span>
								{watched ? (
									<span className='w-4 text-11 text-fg-2'>✓</span>
								) : (
									<Plus size={14} className='text-accent' />
								)}
							</button>
						);
					})}
				</div>
			)}
		</div>
	);
}
