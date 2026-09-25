import {
	AlertTriangle,
	Check,
	CheckCircle2,
	Info,
	type LucideIcon,
	Trash2,
	XCircle,
} from 'lucide-react';
import type { JSX } from 'react';

import type { NotificationLevel } from '@shared/notifications';

import { openNotification } from '../../app/notifications';
import { cn } from '../../lib/cn';
import { formatAge } from '../../lib/format';
import { Badge } from '../../ui/Badge';
import { IconButton } from '../../ui/IconButton';
import type { Collapsed } from './inbox-model';

export const LEVEL_STYLE: Record<
	NotificationLevel,
	{ icon: LucideIcon; className: string; label: string }
> = {
	error: { icon: XCircle, className: 'text-down', label: 'Error' },
	warn: { icon: AlertTriangle, className: 'text-warn', label: 'Warning' },
	success: { icon: CheckCircle2, className: 'text-up', label: 'Success' },
	info: { icon: Info, className: 'text-info', label: 'Info' },
};

export function NotificationRow({
	row,
	moduleName,
	now,
	onMarkRead,
	onDelete,
}: {
	row: Collapsed;
	moduleName: string;
	now: number;
	onMarkRead: (ids: string[]) => void;
	onDelete: (ids: string[]) => void;
}): JSX.Element {
	const { n, ids, unread } = row;
	const { icon: Icon, className, label } = LEVEL_STYLE[n.level];
	return (
		<li className='group relative border-b border-border/60'>
			<button
				type='button'
				onClick={() => {
					// Opening marks the newest read (openNotification); the repeats go with it.
					if (ids.length > 1) onMarkRead(ids.slice(1));
					openNotification(n);
				}}
				className={cn(
					'flex w-full items-start gap-2 px-3 py-2 pr-16 text-left',
					'hover:bg-bg-2 focus-visible:bg-bg-2 focus-visible:shadow-glow focus-visible:outline-none',
				)}
				data-notification={n.id}
				data-ids={ids.join(',')}
				data-read={!unread}
				title={
					n.target
						? 'Open (Enter) · Delete to remove'
						: 'Mark as read (Enter) · Delete to remove'
				}
			>
				<Icon size={14} className={cn('mt-0.5 shrink-0', className)} aria-label={label} />
				<div className='min-w-0 flex-1'>
					<div className='flex items-center gap-2'>
						<span
							className={cn(
								'truncate text-13',
								unread ? 'font-semibold text-fg-0' : 'text-fg-1',
							)}
						>
							{n.title}
						</span>
						{ids.length > 1 && (
							<span
								className='num shrink-0 rounded-sm bg-bg-3 px-1 text-11 text-fg-1'
								title={`${ids.length} times`}
							>
								×{ids.length}
							</span>
						)}
						{unread && (
							<span
								className='size-1.5 shrink-0 rounded-full bg-accent'
								aria-label='Unread'
							/>
						)}
					</div>
					{n.body && <p className='line-clamp-2 text-12 text-fg-2'>{n.body}</p>}
				</div>
				<div className='flex shrink-0 flex-col items-end gap-1'>
					<span className='num text-11 text-fg-2'>{formatAge(n.createdAt, now)}</span>
					<Badge>{moduleName}</Badge>
				</div>
			</button>
			<div className='absolute top-1.5 right-2 flex gap-0.5 opacity-0 group-focus-within:opacity-100 group-hover:opacity-100'>
				{unread && (
					<IconButton
						label='Mark read'
						size='sm'
						icon={<Check size={11} />}
						onClick={() => onMarkRead(ids)}
					/>
				)}
				<IconButton
					label='Delete'
					size='sm'
					icon={<Trash2 size={11} />}
					onClick={() => onDelete(ids)}
				/>
			</div>
		</li>
	);
}
