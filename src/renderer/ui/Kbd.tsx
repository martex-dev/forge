import type { JSX } from 'react';

import { cn } from '@renderer/lib/cn';

interface KbdProps {
	/** Shortcut such as "Ctrl+K" or "Ctrl+Shift+P"; split into individual keys. */
	keys: string;
	className?: string;
}

export function Kbd({ keys, className }: KbdProps): JSX.Element {
	return (
		<span className={cn('inline-flex items-center gap-0.5', className)}>
			{keys.split('+').map((key) => (
				<kbd
					key={key}
					className='inline-flex h-4 min-w-4 items-center justify-center rounded-sm border border-border bg-bg-2 px-1 text-11 text-fg-1'
				>
					{key}
				</kbd>
			))}
		</span>
	);
}
