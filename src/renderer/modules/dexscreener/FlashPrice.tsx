import { type JSX, useState } from 'react';

import { cn } from '../../lib/cn';
import { formatPrice } from '../../lib/format';

/**
 * A price that briefly flashes green/red when it changes (400 ms fade, design system §6).
 * The span is re-keyed on every tick so the CSS animation restarts.
 */
export function FlashPrice({
	value,
	className,
}: {
	value: number | null;
	className?: string;
}): JSX.Element {
	const [prev, setPrev] = useState(value);
	const [flash, setFlash] = useState<{ dir: 'up' | 'down' | null; n: number }>({
		dir: null,
		n: 0,
	});
	if (value !== prev) {
		setPrev(value);
		if (value !== null && prev !== null) {
			setFlash((f) => ({ dir: value > prev ? 'up' : 'down', n: f.n + 1 }));
		}
	}

	return (
		<span
			key={flash.n}
			className={cn(
				'num rounded-sm px-1',
				flash.dir === 'up' && 'flash-up',
				flash.dir === 'down' && 'flash-down',
				className,
			)}
			data-flash={flash.dir ?? undefined}
		>
			{value === null ? '—' : `$${formatPrice(value)}`}
		</span>
	);
}
