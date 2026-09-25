import type { JSX } from 'react';

import type { RunStatus } from '@shared/ipc/channels/lab';

import { cn } from '../../lib/cn';

export const STATUS_LABEL: Record<RunStatus, string> = {
	running: 'Running',
	finished: 'Finished',
	failed: 'Failed',
	interrupted: 'Interrupted',
};

const STYLE: Record<RunStatus, string> = {
	running: 'bg-accent animate-pulse motion-reduce:animate-none',
	finished: 'bg-up',
	failed: 'bg-down',
	interrupted: 'bg-warn',
};

export function RunStatusDot({ status }: { status: RunStatus }): JSX.Element {
	return (
		<span
			className={cn('inline-block size-2 shrink-0 rounded-full', STYLE[status])}
			title={STATUS_LABEL[status]}
			aria-label={STATUS_LABEL[status]}
			role='img'
		/>
	);
}
