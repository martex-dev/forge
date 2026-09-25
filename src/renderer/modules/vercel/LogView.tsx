import { type JSX, useEffect, useRef } from 'react';

import type { LogLine } from '@shared/ipc/channels/vercel';

import { cn } from '../../lib/cn';

const time = (t: number): string =>
	t ? new Date(t).toLocaleTimeString([], { hour12: false }) : '';

/** Monospace log with timestamps; sticks to the bottom while following a live build. */
export function LogView({
	lines,
	follow,
	label,
}: {
	lines: LogLine[];
	follow: boolean;
	label: string;
}): JSX.Element {
	const ref = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const el = ref.current;
		if (follow && el) el.scrollTop = el.scrollHeight;
	}, [lines, follow]);
	return (
		<div
			ref={ref}
			role='log'
			aria-label={label}
			className='selectable min-h-0 flex-1 overflow-auto bg-bg-0 p-2 font-mono text-12'
		>
			{lines.length === 0 ? (
				<p className='text-fg-2'>No log lines.</p>
			) : (
				lines.map((l, i) => (
					<div key={i} className='flex gap-2 whitespace-pre-wrap'>
						<span className='num shrink-0 text-fg-2'>{time(l.t)}</span>
						<span
							className={cn(
								'min-w-0 break-all',
								l.level === 'error'
									? 'text-down'
									: l.level === 'warn'
										? 'text-warn'
										: 'text-fg-1',
							)}
						>
							{l.text}
						</span>
					</div>
				))
			)}
		</div>
	);
}
