import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { JSX } from 'react';

import type { SidecarState, SidecarStatus } from '@shared/ipc/channels/sidecar';

import { cn } from '../lib/cn';
import { call } from '../lib/ipc';
import { useForgeEvent } from '../lib/use-forge-event';

const KEY = ['sidecar', 'status'] as const;

const DOT: Record<SidecarState, string> = {
	ready: 'bg-up',
	starting: 'bg-warn',
	restarting: 'bg-warn animate-pulse motion-reduce:animate-none',
	error: 'bg-down',
	stopped: 'bg-down',
	disabled: 'bg-fg-2',
};

const LABEL: Record<SidecarState, string> = {
	ready: 'Sidecar ready',
	starting: 'Sidecar starting…',
	restarting: 'Sidecar restarting…',
	error: 'Sidecar failed',
	stopped: 'Sidecar stopped',
	disabled: 'Sidecar disabled',
};

function describe(status: SidecarStatus): string {
	const parts = [LABEL[status.state]];
	if (status.state === 'restarting') parts.push(`attempt ${status.attempt}`);
	if (status.version) parts.push(`v${status.version}`);
	if (status.python) parts.push(`Python ${status.python}`);
	if (status.message) parts.push(status.message);
	return parts.join(' · ');
}

export function SidecarIndicator(): JSX.Element {
	const client = useQueryClient();
	const query = useQuery({ queryKey: KEY, queryFn: () => call('sidecar:getStatus') });
	useForgeEvent('sidecar:status', (status) => client.setQueryData(KEY, status));

	const status: SidecarStatus = query.data ?? { state: 'starting', attempt: 0 };
	const label = query.isError ? 'Sidecar status unavailable' : describe(status);

	return (
		<span className='flex items-center gap-1.5' title={label} data-sidecar-state={status.state}>
			<span
				className={cn('size-2 rounded-full', query.isError ? 'bg-down' : DOT[status.state])}
			/>
			<span>Sidecar</span>
		</span>
	);
}
