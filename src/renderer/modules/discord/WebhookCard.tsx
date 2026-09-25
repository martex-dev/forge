import { Trash2 } from 'lucide-react';
import type { JSX } from 'react';

import type { ForwardRule, WebhookInfo } from '@shared/ipc/channels/discord';
import type { ModuleInfo } from '@shared/modules/types';
import type { NotificationLevel } from '@shared/notifications';

import { cn } from '../../lib/cn';
import { IconButton } from '../../ui/IconButton';
import { Switch } from '../../ui/Switch';

const LEVELS: NotificationLevel[] = ['error', 'warn', 'success', 'info'];

function Chip({
	on,
	label,
	onClick,
}: {
	on: boolean;
	label: string;
	onClick: () => void;
}): JSX.Element {
	return (
		<button
			type='button'
			aria-pressed={on}
			onClick={onClick}
			className={cn(
				'h-5 rounded-sm border px-1.5 text-11 focus-visible:shadow-glow focus-visible:outline-none',
				on
					? 'border-accent/50 bg-accent-soft text-fg-0'
					: 'border-border text-fg-2 hover:text-fg-1',
			)}
		>
			{label}
		</button>
	);
}

const toggle = <T,>(list: T[], item: T): T[] =>
	list.includes(item) ? list.filter((x) => x !== item) : [...list, item];

export function WebhookCard({
	hook,
	modules,
	onForward,
	onRemove,
}: {
	hook: WebhookInfo;
	modules: ModuleInfo[];
	onForward: (rule: ForwardRule) => void;
	onRemove: () => void;
}): JSX.Element {
	const rule = hook.forward;
	return (
		<li
			className='flex flex-col gap-2 rounded-sm border border-border bg-bg-2 p-2'
			data-webhook={hook.name}
		>
			<div className='flex items-center gap-2'>
				<span className='text-13 font-medium text-fg-0'>{hook.name}</span>
				{hook.webhookName && (
					<span className='text-11 text-fg-2'>posts as “{hook.webhookName}”</span>
				)}
				<IconButton
					label={`Remove ${hook.name}`}
					size='sm'
					icon={<Trash2 size={11} />}
					className='ml-auto'
					onClick={onRemove}
				/>
			</div>
			<label className='flex items-center gap-2 text-12 text-fg-1'>
				<Switch
					checked={rule.enabled}
					onCheckedChange={(enabled) => onForward({ ...rule, enabled })}
					aria-label={`Forward notifications to ${hook.name}`}
				/>
				Forward Forge notifications here
			</label>
			{rule.enabled && (
				<div className='flex flex-col gap-1.5 pl-1'>
					<div
						className='flex flex-wrap items-center gap-1'
						role='group'
						aria-label='Levels'
					>
						<span className='w-16 text-11 text-fg-2'>Levels</span>
						{LEVELS.map((l) => (
							<Chip
								key={l}
								on={rule.levels.includes(l)}
								label={l}
								onClick={() =>
									onForward({ ...rule, levels: toggle(rule.levels, l) })
								}
							/>
						))}
					</div>
					<div
						className='flex flex-wrap items-center gap-1'
						role='group'
						aria-label='From'
					>
						<span className='w-16 text-11 text-fg-2'>From</span>
						<Chip
							on={rule.modules.length === 0}
							label='everything'
							onClick={() => onForward({ ...rule, modules: [] })}
						/>
						{modules
							.filter((m) => m.enabled && m.id !== 'discord')
							.map((m) => (
								<Chip
									key={m.id}
									on={rule.modules.includes(m.id)}
									label={m.name}
									onClick={() =>
										onForward({ ...rule, modules: toggle(rule.modules, m.id) })
									}
								/>
							))}
					</div>
				</div>
			)}
			{hook.lastError && (
				<p className='text-11 text-down'>Last forward failed: {hook.lastError}</p>
			)}
		</li>
	);
}
