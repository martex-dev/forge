import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Wallet } from 'lucide-react';
import { type JSX, useState } from 'react';

import type { WatchedWallet } from '@shared/ipc/channels/solana';

import { cn } from '../../lib/cn';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { Input } from '../../ui/Input';
import type { PanelProps } from '../types';
import { SnapshotView } from './SnapshotView';

const KEY = ['solana', 'wallets'] as const;

export function WalletsPanel({ params, setParams }: PanelProps): JSX.Element {
	const client = useQueryClient();
	const wallets = useQuery({ queryKey: KEY, queryFn: () => call('solana:wallets') }).data ?? [];
	const [address, setAddress] = useState('');
	const [label, setLabel] = useState('');
	const [error, setError] = useState<string | null>(null);
	const setList = (list: WatchedWallet[]): void => {
		client.setQueryData(KEY, list);
	};
	const add = useMutation({
		mutationFn: () => call('solana:addWallet', { address, label }),
		onSuccess: (list) => {
			setList(list);
			const added = list.at(-1);
			if (added) setParams({ address: added.address });
			setAddress('');
			setLabel('');
			setError(null);
		},
		onError: (e) => setError(e.message),
	});
	const remove = useMutation({
		mutationFn: (a: string) => call('solana:removeWallet', a),
		onSuccess: setList,
		onError: (e) => toast.error('Could not remove wallet', e.message),
	});
	const selected = wallets.find((w) => w.address === params['address']) ?? wallets[0] ?? null;

	return (
		<div className='flex h-full flex-col bg-bg-1' data-solana>
			<form
				className='flex flex-col gap-1 border-b border-border p-2'
				onSubmit={(e) => {
					e.preventDefault();
					if (address.trim()) add.mutate();
				}}
			>
				<div className='flex gap-1'>
					<Input
						aria-label='Wallet address'
						placeholder='Public address (never a private key)'
						value={address}
						invalid={error !== null}
						onChange={(e) => {
							setAddress(e.target.value);
							setError(null);
						}}
						className='min-w-0 flex-1 font-mono text-12'
						spellCheck={false}
						autoComplete='off'
					/>
					<Input
						aria-label='Label'
						placeholder='Label'
						value={label}
						onChange={(e) => setLabel(e.target.value)}
						className='w-24 text-12'
					/>
					<Button
						type='submit'
						size='sm'
						icon={<Plus size={12} />}
						loading={add.isPending}
						disabled={!address.trim()}
					>
						Watch
					</Button>
				</div>
				{error && (
					<p role='alert' className='text-12 text-down'>
						{error}
					</p>
				)}
			</form>
			{wallets.length === 0 ? (
				<EmptyState
					icon={<Wallet size={20} />}
					title='No wallets watched'
					description='Paste a Solana public address to see its balances and activity. Forge never needs or accepts private keys.'
				/>
			) : (
				<div className='min-h-0 flex-1 overflow-y-auto'>
					<ul
						className='flex flex-wrap gap-1 border-b border-border p-2'
						aria-label='Watched wallets'
					>
						{wallets.map((w) => (
							<li key={w.address} className='group flex items-center'>
								<button
									type='button'
									onClick={() => setParams({ address: w.address })}
									aria-pressed={w.address === selected?.address}
									className={cn(
										'rounded-sm border px-2 py-0.5 text-12 focus-visible:shadow-glow focus-visible:outline-none',
										w.address === selected?.address
											? 'border-accent/50 bg-accent-soft text-fg-0'
											: 'border-border text-fg-1 hover:border-border-strong',
									)}
									title={w.address}
									data-wallet={w.label}
								>
									{w.label}
								</button>
								<IconButton
									label={`Stop watching ${w.label}`}
									size='sm'
									icon={<Trash2 size={11} />}
									className='opacity-0 group-hover:opacity-100 focus-visible:opacity-100'
									onClick={() => remove.mutate(w.address)}
								/>
							</li>
						))}
					</ul>
					{selected && <SnapshotView key={selected.address} address={selected.address} />}
				</div>
			)}
		</div>
	);
}
