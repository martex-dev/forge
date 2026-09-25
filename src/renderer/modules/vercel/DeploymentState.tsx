import type { JSX } from 'react';

import type { Deployment, DeploymentState } from '@shared/ipc/channels/vercel';

import { cn } from '../../lib/cn';
import { Badge } from '../../ui/Badge';

const DOT: Record<DeploymentState, string> = {
	QUEUED: 'bg-fg-2',
	INITIALIZING: 'bg-warn animate-pulse motion-reduce:animate-none',
	BUILDING: 'bg-warn animate-pulse motion-reduce:animate-none',
	READY: 'bg-up',
	ERROR: 'bg-down',
	CANCELED: 'bg-border-strong',
	UNKNOWN: 'bg-border-strong',
};

export function StateDot({ state }: { state: DeploymentState }): JSX.Element {
	return (
		<span
			role='img'
			aria-label={state.toLowerCase()}
			title={state.toLowerCase()}
			className={cn('inline-block size-2 shrink-0 rounded-full', DOT[state])}
		/>
	);
}

export function TargetBadge({ d }: { d: Deployment }): JSX.Element {
	if (d.isCurrentProduction) return <Badge tone='up'>current</Badge>;
	return <Badge tone={d.target === 'production' ? 'accent' : 'neutral'}>{d.target}</Badge>;
}
