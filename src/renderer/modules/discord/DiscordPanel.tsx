import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Send, Webhook } from 'lucide-react';
import { type FormEvent, type JSX, useState } from 'react';

import { type WebhookInfo, WebhookUrlSchema } from '@shared/ipc/channels/discord';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { useUiStore } from '../../stores/ui-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { Input } from '../../ui/Input';
import { Select } from '../../ui/Select';
import { Spinner } from '../../ui/Spinner';
import { WebhookCard } from './WebhookCard';

const KEY = ['discord', 'hooks'] as const;

function AddWebhook({ onDone }: { onDone: () => void }): JSX.Element {
	const client = useQueryClient();
	const [name, setName] = useState('');
	const [url, setUrl] = useState('');
	const valid = WebhookUrlSchema.safeParse(url);
	const add = useMutation({
		mutationFn: () => call('discord:add', { name, url }),
		onSuccess: (list) => {
			client.setQueryData(KEY, list);
			setName('');
			setUrl('');
			onDone();
		},
		onError: (e) => toast.error('Webhook not added', e.message),
	});
	const submit = (e: FormEvent): void => {
		e.preventDefault();
		if (name.trim() && valid.success) add.mutate();
	};
	return (
		<form
			onSubmit={submit}
			className='flex flex-wrap items-end gap-2 rounded-sm border border-border p-2'
			data-discord-add
		>
			<label className='flex flex-col gap-1'>
				<span className='text-11 text-fg-2'>Name</span>
				<Input
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder='#alerts'
					aria-label='Webhook name'
					className='w-40'
				/>
			</label>
			<label className='flex min-w-64 flex-1 flex-col gap-1'>
				<span className='text-11 text-fg-2'>
					Webhook URL (stored as a secret, never shown again)
				</span>
				<Input
					type='password'
					autoComplete='off'
					value={url}
					invalid={url !== '' && !valid.success}
					onChange={(e) => setUrl(e.target.value)}
					placeholder='https://discord.com/api/webhooks/…'
					aria-label='Webhook URL'
				/>
			</label>
			<Button
				type='submit'
				size='sm'
				variant='primary'
				loading={add.isPending}
				disabled={!name.trim() || !valid.success}
			>
				Check & add
			</Button>
		</form>
	);
}

function Compose({ hooks }: { hooks: WebhookInfo[] }): JSX.Element {
	const [target, setTarget] = useState(hooks[0]?.id ?? '');
	const [text, setText] = useState('');
	const send = useMutation({
		mutationFn: () => call('discord:send', { id: target, content: text }),
		onSuccess: () => {
			setText('');
			toast.success('Posted to Discord');
		},
		onError: (e) => toast.error('Not posted', e.message),
	});
	const ready = text.trim() !== '' && hooks.some((h) => h.id === target);
	return (
		<section className='flex flex-col gap-2' aria-label='Post a message'>
			<div className='flex items-center gap-2'>
				<h3 className='text-12 font-medium text-fg-1'>Post</h3>
				<Select
					aria-label='Channel'
					className='h-6 min-w-40'
					value={target}
					onValueChange={setTarget}
					options={hooks.map((h) => ({ value: h.id, label: h.name }))}
				/>
				<span className='num ml-auto text-11 text-fg-2'>{text.length}/2000</span>
			</div>
			<textarea
				value={text}
				maxLength={2000}
				onChange={(e) => setText(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === 'Enter' && e.ctrlKey && ready) {
						e.preventDefault();
						send.mutate();
					}
				}}
				rows={4}
				aria-label='Message'
				placeholder='Markdown works. Ctrl+Enter to send. Mentions are never pinged.'
				className='selectable w-full resize-y rounded-sm border border-border bg-bg-2 px-2 py-1.5 text-13 text-fg-0 outline-none placeholder:text-fg-2 focus:border-accent focus:shadow-glow'
			/>
			<Button
				size='sm'
				variant='primary'
				icon={<Send size={12} />}
				className='self-end'
				disabled={!ready}
				loading={send.isPending}
				onClick={() => send.mutate()}
			>
				Send
			</Button>
		</section>
	);
}

export function DiscordPanel(): JSX.Element {
	const client = useQueryClient();
	const visible = useUiStore((s) => s.room === 'hub');
	const hooks = useQuery({
		queryKey: KEY,
		queryFn: () => call('discord:list'),
		refetchInterval: visible ? 15_000 : false,
	});
	const modules = useQuery({
		queryKey: ['modules', 'list'],
		queryFn: () => call('modules:list'),
	});
	const [adding, setAdding] = useState(false);
	const update = useMutation({
		mutationFn: (input: Parameters<typeof call<'discord:update'>>[1]) =>
			call('discord:update', input),
		onSuccess: (list) => client.setQueryData(KEY, list),
		onError: (e) => toast.error('Not saved', e.message),
	});
	const remove = useMutation({
		mutationFn: (id: string) => call('discord:remove', id),
		onSuccess: (list) => client.setQueryData(KEY, list),
	});

	if (hooks.isPending) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Loading webhooks' />
			</div>
		);
	}
	const list = hooks.data ?? [];
	return (
		<div className='flex h-full flex-col gap-3 overflow-y-auto bg-bg-1 p-3' data-discord>
			<div className='flex items-center gap-2'>
				<h2 className='text-13 font-semibold text-fg-0'>Webhooks</h2>
				<Button
					size='sm'
					icon={<Plus size={12} />}
					className='ml-auto'
					onClick={() => setAdding((a) => !a)}
				>
					Add webhook
				</Button>
			</div>
			{(adding || list.length === 0) && <AddWebhook onDone={() => setAdding(false)} />}
			{list.length === 0 ? (
				<EmptyState
					icon={<Webhook size={20} />}
					title='No webhooks yet'
					description='In Discord: channel settings → Integrations → Webhooks → New webhook → Copy URL. Forge posts as that webhook; your account and tokens are never involved.'
				/>
			) : (
				<>
					<ul className='flex flex-col gap-2'>
						{list.map((h) => (
							<WebhookCard
								key={h.id}
								hook={h}
								modules={modules.data ?? []}
								onForward={(forward) => update.mutate({ id: h.id, forward })}
								onRemove={() => remove.mutate(h.id)}
							/>
						))}
					</ul>
					<Compose hooks={list} />
				</>
			)}
		</div>
	);
}
