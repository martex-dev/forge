import { useQuery } from '@tanstack/react-query';
import { type JSX, useState } from 'react';

import type { Alert, PriceSource } from '@shared/ipc/channels/alerts';
import type { Impact } from '@shared/ipc/channels/calendar';
import { BinanceSymbolSchema } from '@shared/ipc/channels/chart';

import { cn } from '../../lib/cn';
import { formatPrice } from '../../lib/format';
import { call } from '../../lib/ipc';
import { Button } from '../../ui/Button';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';

export type AlertDraft = Partial<Pick<Alert & { kind: 'price' }, 'source' | 'value' | 'op'>> & {
	kind?: Alert['kind'];
};

const IMPACTS: Impact[] = ['high', 'medium', 'low'];

function Chip({
	on,
	onClick,
	children,
}: {
	on: boolean;
	onClick: () => void;
	children: string;
}): JSX.Element {
	return (
		<button
			type='button'
			aria-pressed={on}
			onClick={onClick}
			className={cn(
				'h-6 rounded-sm border px-2 text-11 focus-visible:shadow-glow focus-visible:outline-none',
				on
					? 'border-accent/50 bg-accent-soft text-fg-0'
					: 'border-border text-fg-2 hover:text-fg-1',
			)}
		>
			{children}
		</button>
	);
}

export function AlertForm({
	initial,
	onSave,
	onCancel,
}: {
	initial: Alert | AlertDraft;
	onSave: (alert: Alert) => void;
	onCancel: () => void;
}): JSX.Element {
	const existing = 'id' in initial ? initial : null;
	const [kind, setKind] = useState<Alert['kind']>(initial.kind ?? 'price');
	const priceInit = initial.kind === 'calendar' ? null : initial;
	const [source, setSource] = useState<PriceSource>(
		priceInit?.source ?? { kind: 'binance', symbol: 'BTCUSDT' },
	);
	const [symbolText, setSymbolText] = useState(source.kind === 'binance' ? source.symbol : '');
	const [op, setOp] = useState<'above' | 'below'>(priceInit?.op ?? 'above');
	const [value, setValue] = useState(priceInit?.value ? String(priceInit.value) : '');
	const [repeat, setRepeat] = useState<'once' | 'every'>(
		existing?.kind === 'price' ? existing.repeat : 'once',
	);
	const [note, setNote] = useState(existing?.kind === 'price' ? existing.note : '');
	const calInit = existing?.kind === 'calendar' ? existing : null;
	const [minutes, setMinutes] = useState(String(calInit?.minutesBefore ?? 15));
	const [impacts, setImpacts] = useState<Impact[]>(calInit?.impacts ?? ['high']);
	const [currencies, setCurrencies] = useState((calInit?.currencies ?? []).join(', '));
	const [error, setError] = useState<string | null>(null);

	const current = useQuery({
		queryKey: ['alerts', 'price', source],
		queryFn: () => call('alerts:price', source),
		enabled: kind === 'price',
		staleTime: 10_000,
		retry: false,
	});
	const watchlist =
		useQuery({ queryKey: ['dex', 'watchlist'], queryFn: () => call('dex:watchlist') }).data ??
		[];

	const save = (): void => {
		const base = {
			id: existing?.id ?? crypto.randomUUID(),
			enabled: true,
			createdAt: existing?.createdAt ?? Date.now(),
			lastFiredAt: existing?.lastFiredAt ?? null,
		};
		if (kind === 'calendar') {
			const list = currencies
				.split(/[,\s]+/)
				.map((c) => c.trim().toUpperCase())
				.filter(Boolean);
			if (impacts.length === 0) return setError('Pick at least one impact level');
			if (list.some((c) => c.length !== 3))
				return setError('Currencies are 3-letter codes, e.g. USD, EUR');
			onSave({
				...base,
				kind: 'calendar',
				minutesBefore: Number(minutes),
				impacts,
				currencies: list,
			});
			return;
		}
		const threshold = Number(value);
		if (!(threshold > 0)) return setError('Enter a price above 0');
		let finalSource = source;
		if (source.kind === 'binance') {
			const parsed = BinanceSymbolSchema.safeParse(symbolText);
			if (!parsed.success) return setError('Use a Binance symbol like BTCUSDT');
			finalSource = { kind: 'binance', symbol: parsed.data };
		}
		onSave({
			...base,
			kind: 'price',
			source: finalSource,
			op,
			value: threshold,
			repeat,
			note: note.trim(),
		});
	};

	return (
		<form
			className='flex flex-col gap-2 border-b border-border bg-bg-2/40 p-3'
			aria-label={existing ? 'Edit alert' : 'New alert'}
			onSubmit={(e) => {
				e.preventDefault();
				save();
			}}
		>
			<div className='flex gap-1' role='group' aria-label='Alert type'>
				<Chip on={kind === 'price'} onClick={() => setKind('price')}>
					Price
				</Chip>
				<Chip on={kind === 'calendar'} onClick={() => setKind('calendar')}>
					Calendar event
				</Chip>
			</div>
			{kind === 'price' ? (
				<>
					<div className='flex flex-wrap items-center gap-1'>
						<Select
							aria-label='Price source'
							className='h-7 w-28'
							value={source.kind}
							onValueChange={(v) => {
								const first = watchlist[0];
								if (v === 'dex' && first)
									setSource({
										kind: 'dex',
										chainId: first.chainId,
										pairAddress: first.pairAddress,
										label: first.symbol,
									});
								if (v === 'binance')
									setSource({ kind: 'binance', symbol: symbolText || 'BTCUSDT' });
							}}
							options={[
								{ value: 'binance', label: 'Binance' },
								{
									value: 'dex',
									label: 'DEX pair',
									disabled: watchlist.length === 0,
								},
							]}
						/>
						{source.kind === 'binance' ? (
							<Input
								aria-label='Symbol'
								value={symbolText}
								onChange={(e) => setSymbolText(e.target.value.toUpperCase())}
								onBlur={() => {
									const parsed = BinanceSymbolSchema.safeParse(symbolText);
									if (parsed.success)
										setSource({ kind: 'binance', symbol: parsed.data });
								}}
								className='w-28 font-mono text-12'
							/>
						) : (
							<Select
								aria-label='Watched pair'
								className='h-7 w-40'
								value={`${source.chainId}:${source.pairAddress}`}
								onValueChange={(v) => {
									const w = watchlist.find(
										(x) => `${x.chainId}:${x.pairAddress}` === v,
									);
									if (w)
										setSource({
											kind: 'dex',
											chainId: w.chainId,
											pairAddress: w.pairAddress,
											label: w.symbol,
										});
								}}
								options={watchlist.map((w) => ({
									value: `${w.chainId}:${w.pairAddress}`,
									label: `${w.symbol} · ${w.chainId}`,
								}))}
							/>
						)}
						<span className='num text-11 text-fg-2' data-current-price>
							now {current.isLoading ? '…' : formatPrice(current.data ?? null)}
						</span>
					</div>
					<div className='flex flex-wrap items-center gap-1'>
						<Select
							aria-label='Condition'
							className='h-7 w-36'
							value={op}
							onValueChange={(v) => setOp(v === 'below' ? 'below' : 'above')}
							options={[
								{ value: 'above', label: 'crosses above' },
								{ value: 'below', label: 'crosses below' },
							]}
						/>
						<Input
							aria-label='Price'
							inputMode='decimal'
							value={value}
							onChange={(e) => setValue(e.target.value)}
							className='w-32 font-mono text-12'
						/>
						<Select
							aria-label='Repeat'
							className='h-7 w-32'
							value={repeat}
							onValueChange={(v) => setRepeat(v === 'every' ? 'every' : 'once')}
							options={[
								{ value: 'once', label: 'once' },
								{ value: 'every', label: 'every cross' },
							]}
						/>
					</div>
					<Input
						aria-label='Note'
						placeholder='Note (optional)'
						value={note}
						onChange={(e) => setNote(e.target.value)}
						className='text-12'
					/>
				</>
			) : (
				<>
					<div className='flex flex-wrap items-center gap-1'>
						<span className='text-12 text-fg-1'>Notify</span>
						<Select
							aria-label='Minutes before'
							className='h-7 w-24'
							value={minutes}
							onValueChange={setMinutes}
							options={['5', '10', '15', '30', '60'].map((m) => ({
								value: m,
								label: `${m} min`,
							}))}
						/>
						<span className='text-12 text-fg-1'>before</span>
						{IMPACTS.map((i) => (
							<Chip
								key={i}
								on={impacts.includes(i)}
								onClick={() =>
									setImpacts(
										impacts.includes(i)
											? impacts.filter((x) => x !== i)
											: [...impacts, i],
									)
								}
							>
								{i}
							</Chip>
						))}
						<span className='text-12 text-fg-1'>impact events</span>
					</div>
					<Input
						aria-label='Currencies'
						placeholder='Currencies, e.g. USD, EUR (empty = all)'
						value={currencies}
						onChange={(e) => setCurrencies(e.target.value)}
						className='text-12'
					/>
				</>
			)}
			{error && (
				<p role='alert' className='text-12 text-down'>
					{error}
				</p>
			)}
			<div className='flex justify-end gap-1'>
				<Button type='button' size='sm' variant='ghost' onClick={onCancel}>
					Cancel
				</Button>
				<Button type='submit' size='sm' variant='primary'>
					{existing ? 'Save alert' : 'Create alert'}
				</Button>
			</div>
		</form>
	);
}
