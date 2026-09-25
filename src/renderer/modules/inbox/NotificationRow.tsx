import { AlertTriangle, CheckCircle2, Info, type LucideIcon, XCircle } from 'lucide-react';
import type { JSX } from 'react';

import type { ForgeNotification, NotificationLevel } from '@shared/notifications';

import { openNotification } from '../../app/notifications';
import { cn } from '../../lib/cn';
import { formatAge } from '../../lib/format';
import { Badge } from '../../ui/Badge';

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
	n,
	moduleName,
	now,
}: {
	n: ForgeNotification;
	moduleName: string;
	now: number;
}): JSX.Element {
	const { icon: Icon, className, label } = LEVEL_STYLE[n.level];
	return (
		<li>
			<button
				type='button'
				onClick={() => openNotification(n)}
				className={cn(
					'flex w-full items-start gap-2 border-b border-border/60 px-3 py-2 text-left',
					'hover:bg-bg-2 focus-visible:shadow-glow focus-visible:outline-none',
				)}
				data-notification={n.id}
				data-read={n.read}
				title={n.target ? 'Open' : 'Mark as read'}
			>
				<Icon size={14} className={cn('mt-0.5 shrink-0', className)} aria-label={label} />
				<div className='min-w-0 flex-1'>
					<div className='flex items-center gap-2'>
						<span
							className={cn(
								'truncate text-13',
								n.read ? 'text-fg-1' : 'font-semibold text-fg-0',
							)}
						>
							{n.title}
						</span>
						{!n.read && (
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
		</li>
	);
}
