import type { UseQueryResult } from '@tanstack/react-query';
import { ArrowUpRight, type LucideIcon } from 'lucide-react';
import type { JSX, ReactNode } from 'react';

import { commandContext } from '../../app/commands/use-commands';
import { Spinner } from '../../ui/Spinner';

/**
 * One dashboard card: a header that opens the source panel, and a body that shows loading, a
 * short error, or the content. A card never takes the whole dashboard down with it.
 */
export function TodayCard({
	title,
	icon: Icon,
	panelId,
	query,
	children,
	accent,
}: {
	title: string;
	icon: LucideIcon;
	panelId: string;
	query?: Pick<UseQueryResult<unknown>, 'isPending' | 'isError' | 'error'>;
	children: ReactNode;
	/** A number worth seeing at a glance, top right. */
	accent?: ReactNode;
}): JSX.Element {
	return (
		<section
			className='flex min-h-36 flex-col rounded-sm border border-border bg-bg-1'
			data-today-card={title}
		>
			<header className='flex items-center gap-2 border-b border-border px-3 py-1.5'>
				<Icon size={13} className='text-accent' aria-hidden />
				<h3 className='text-12 font-medium text-fg-0'>{title}</h3>
				{accent !== undefined && <span className='num ml-auto text-13'>{accent}</span>}
				<button
					type='button'
					aria-label={`Open ${title}`}
					title={`Open ${title}`}
					onClick={() => commandContext.openPanel(panelId)}
					className={`${accent === undefined ? 'ml-auto ' : ''}rounded-sm p-0.5 text-fg-2 hover:text-fg-0 focus-visible:shadow-glow focus-visible:outline-none`}
				>
					<ArrowUpRight size={13} />
				</button>
			</header>
			<div className='min-h-0 flex-1 px-3 py-2 text-12'>
				{query?.isPending ? (
					<Spinner size={12} label={`Loading ${title}`} />
				) : query?.isError ? (
					<p className='text-fg-2' title={query.error?.message}>
						Not available: {query.error?.message.split('.')[0]}
					</p>
				) : (
					children
				)}
			</div>
		</section>
	);
}

export function Muted({ children }: { children: ReactNode }): JSX.Element {
	return <p className='text-fg-2'>{children}</p>;
}
