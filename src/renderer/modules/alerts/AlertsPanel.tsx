import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CalendarClock, Pencil, Plus, Trash2 } from 'lucide-react';
import { type JSX, useState } from 'react';

import type { Alert } from '@shared/ipc/channels/alerts';

import { cn } from '../../lib/cn';
import { formatAge, formatPrice } from '../../lib/format';
import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';
import { useNow } from '../../lib/use-now';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { IconButton } from '../../ui/IconButton';
import { Switch } from '../../ui/Switch';
import type { PanelProps } from '../types';
import { type AlertDraft, AlertForm } from './AlertForm';

const KEY = ['alerts', 'list'] as const;

function describe(a: Alert): string {
	if (a.kind === 'calendar') {
		const cur = a.currencies.length ? a.currencies.join('/') : 'all currencies';
		return `${a.minutesBefore} min before ${a.impacts.join('/')} impact · ${cur}`;
	}
	const name = a.source.kind === 'binance' ? a.source.symbol : a.source.label;
	return `${name} crosses ${a.op} ${formatPrice(a.value)}`;
}

export function AlertsPanel({ params, setParams }: PanelProps): JSX.Element {
	const client = useQueryClient();
	const rules = useQuery({ queryKey: KEY, queryFn: () => call('alerts:list') }).data ?? [];
	const state =
		useQuery({
			queryKey: ['alerts', 'state'],
			queryFn: () => call('alerts:state'),
			refetchInterval: 15_000,
		}).data ?? [];
	useForgeEvent('alerts:changed', (list) => client.setQueryData(KEY, list));
	const now = useNow(30_000);
	const draft =
		params['draft'] && typeof params['draft'] === 'object'
			? (params['draft'] as AlertDraft)
			: null;
	const [editing, setEditing] = useState<Alert | null>(null);
	const [creating, setCreating] = useState(false);
	const save = useMutation({
		mutationFn: (a: Alert) => call('alerts:save', a),
		onSuccess: (list) => {
			client.setQueryData(KEY, list);
			setEditing(null);
			setCreating(false);
			setParams({ draft: undefined });
		},
		onError: (e) => toast.error('Could not save alert', e.message),
	});
	const remove = useMutation({
		mutationFn: (id: string) => call('alerts:delete', id),
		onSuccess: (list) => client.setQueryData(KEY, list),
	});
	const formInitial: Alert | AlertDraft | null = editing ?? draft ?? (creating ? {} : null);

	return (
		<div className='flex h-full flex-col bg-bg-1' data-alerts>
			<header className='flex items-center gap-2 border-b border-border px-3 py-1'>
				<span className='flex-1 text-12 text-fg-2'>
					{rules.filter((r) => r.enabled).length} active
				</span>
				<Button
					size='sm'
					icon={<Plus size={12} />}
					onClick={() => {
						setEditing(null);
						setCreating(true);
					}}
				>
					New alert
				</Button>
			</header>
			{formInitial && (
				<AlertForm
					key={editing?.id ?? JSON.stringify(draft ?? 'new')}
					initial={formInitial}
					onSave={(a) => save.mutate(a)}
					onCancel={() => {
						setEditing(null);
						setCreating(false);
						setParams({ draft: undefined });
					}}
				/>
			)}
			{rules.length === 0 && !formInitial ? (
				<EmptyState
					icon={<Bell size={20} />}
					title='No alerts'
					description='Price crosses (Binance or DEX pairs) and upcoming high-impact events, as toasts and inbox notifications.'
				/>
			) : (
				<ul className='min-h-0 flex-1 overflow-y-auto' aria-label='Alerts'>
					{rules.map((a) => {
						const s = state.find((x) => x.id === a.id);
						return (
							<li
								key={a.id}
								className='flex items-center gap-2 border-b border-border/60 px-3 py-1.5'
								data-alert={describe(a)}
							>
								{a.kind === 'price' ? (
									<Bell size={13} className='shrink-0 text-fg-2' />
								) : (
									<CalendarClock size={13} className='shrink-0 text-fg-2' />
								)}
								<div className='min-w-0 flex-1'>
									<div
										className={cn(
											'truncate text-13',
											a.enabled ? 'text-fg-0' : 'text-fg-2 line-through',
										)}
									>
										{describe(a)}
									</div>
									<div className='num truncate text-11 text-fg-2'>
										{a.kind === 'price' &&
											s?.price !== undefined &&
											s.price !== null &&
											`now ${formatPrice(s.price)} · `}
										{s?.error ? (
											<span className='text-down'>{s.error}</span>
										) : null}
										{a.lastFiredAt
											? `fired ${formatAge(a.lastFiredAt, now)} ago`
											: a.enabled
												? 'armed'
												: 'off'}
										{a.kind === 'price' && a.repeat === 'every'
											? ' · repeats'
											: ''}
									</div>
								</div>
								<Switch
									checked={a.enabled}
									aria-label={`Enable ${describe(a)}`}
									onCheckedChange={(enabled) => save.mutate({ ...a, enabled })}
								/>
								<IconButton
									label='Edit'
									size='sm'
									icon={<Pencil size={11} />}
									onClick={() => {
										setCreating(false);
										setEditing(a);
									}}
								/>
								<IconButton
									label='Delete'
									size='sm'
									icon={<Trash2 size={11} />}
									onClick={() => remove.mutate(a.id)}
								/>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
