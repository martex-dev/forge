import { type JSX, type ReactNode, useState } from 'react';

import { BinanceSymbolSchema, type Interval, INTERVALS } from '@shared/ipc/channels/chart';

import { cn } from '../../lib/cn';
import { toast } from '../../stores/toast-store';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { type ChartParams, QUICK_SYMBOLS } from './chart-model';
import { useWatchedPools } from './use-candles';

export type ChartMode = 'binance' | 'pool';

function Chip({
	pressed,
	onClick,
	children,
	label,
}: {
	pressed: boolean;
	onClick: () => void;
	children: ReactNode;
	label?: string;
}): JSX.Element {
	return (
		<button
			type='button'
			aria-pressed={pressed}
			aria-label={label}
			onClick={onClick}
			className={cn(
				'num flex h-6 items-center rounded-sm border px-1.5 text-11 transition-colors transition-fast',
				'focus-visible:shadow-glow focus-visible:outline-none',
				pressed
					? 'border-accent/50 bg-accent-soft text-fg-0'
					: 'border-border text-fg-2 hover:border-border-strong hover:text-fg-1',
			)}
		>
			{children}
		</button>
	);
}

function SymbolInput({
	symbol,
	onCommit,
}: {
	symbol: string;
	onCommit: (symbol: string) => void;
}): JSX.Element {
	const [text, setText] = useState(symbol);
	const [shown, setShown] = useState(symbol);
	// Follow outside changes (quick chips, restored layout) without an effect.
	if (shown !== symbol) {
		setShown(symbol);
		setText(symbol);
	}
	const commit = (): void => {
		const parsed = BinanceSymbolSchema.safeParse(text);
		if (!parsed.success) {
			toast.warn('Invalid symbol', 'Use a Binance spot symbol like BTCUSDT');
			setText(symbol);
			return;
		}
		if (parsed.data !== symbol) onCommit(parsed.data);
	};
	return (
		<Input
			aria-label='Binance symbol'
			value={text}
			onChange={(e) => setText(e.target.value.toUpperCase())}
			onBlur={commit}
			onKeyDown={(e) => {
				if (e.key === 'Enter') commit();
				if (e.key === 'Escape') setText(symbol);
			}}
			className='num h-6 w-28'
			spellCheck={false}
		/>
	);
}

interface ChartToolbarProps {
	mode: ChartMode;
	params: ChartParams;
	onMode: (mode: ChartMode) => void;
	onChange: (patch: Partial<ChartParams>) => void;
	status: ReactNode;
}

export function ChartToolbar({
	mode,
	params,
	onMode,
	onChange,
	status,
}: ChartToolbarProps): JSX.Element {
	const { pools, error } = useWatchedPools();
	const { source, interval } = params;
	const poolValue = source.kind === 'pool' ? `${source.chainId}:${source.pairAddress}` : '';

	return (
		<div
			className='flex flex-wrap items-center gap-1 border-b border-border px-2 py-1.5'
			role='toolbar'
			aria-label='Chart controls'
		>
			<Chip pressed={mode === 'binance'} onClick={() => onMode('binance')}>
				Binance
			</Chip>
			<Chip pressed={mode === 'pool'} onClick={() => onMode('pool')}>
				DEX pool
			</Chip>
			<span className='mx-1 h-4 w-px bg-border' aria-hidden />

			{mode === 'binance' ? (
				<>
					<SymbolInput
						symbol={source.kind === 'binance' ? source.symbol : ''}
						onCommit={(symbol) => onChange({ source: { kind: 'binance', symbol } })}
					/>
					{QUICK_SYMBOLS.map((s) => (
						<Chip
							key={s}
							pressed={source.kind === 'binance' && source.symbol === s}
							onClick={() => onChange({ source: { kind: 'binance', symbol: s } })}
						>
							{s.replace(/USDT$/, '')}
						</Chip>
					))}
				</>
			) : (
				<Select
					aria-label='Pool from watchlist'
					className='h-6 w-48'
					value={poolValue}
					placeholder={
						error
							? 'Watchlist unavailable'
							: pools.length
								? 'Pick a watched pair'
								: 'Watchlist is empty'
					}
					disabled={pools.length === 0}
					options={pools.map((p) => ({
						value: `${p.chainId}:${p.pairAddress}`,
						label: `${p.symbol} · ${p.chainId}`,
					}))}
					onValueChange={(value) => {
						const pool = pools.find((p) => `${p.chainId}:${p.pairAddress}` === value);
						if (!pool) return;
						onChange({
							source: {
								kind: 'pool',
								chainId: pool.chainId,
								pairAddress: pool.pairAddress,
							},
							label: pool.symbol,
						});
					}}
				/>
			)}

			<span className='mx-1 h-4 w-px bg-border' aria-hidden />
			<div className='flex gap-0.5' role='group' aria-label='Interval'>
				{INTERVALS.map((i: Interval) => (
					<Chip
						key={i}
						pressed={interval === i}
						onClick={() => onChange({ interval: i })}
						label={`${i} candles`}
					>
						{i}
					</Chip>
				))}
			</div>
			<div className='ml-auto flex items-center gap-2'>{status}</div>
		</div>
	);
}
