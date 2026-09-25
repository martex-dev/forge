import { useQuery } from '@tanstack/react-query';
import { Copy, TerminalSquare } from 'lucide-react';
import { type JSX, useRef } from 'react';

import { type TerminalPresetId, TerminalPresetIdSchema } from '@shared/ipc/channels/terminal';

import { useGeneralSettings } from '../../app/hooks/use-general-settings';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { Button } from '../../ui/Button';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import type { PanelProps } from '../types';
import { useXterm } from './use-xterm';

export const PRESETS_KEY = ['terminal', 'presets'] as const;

/** Stable, IPC-safe session id for panels restored without one. */
export function sessionIdFor(panelId: string, params: Record<string, unknown>): string {
	const given = params['sessionId'];
	if (typeof given === 'string' && /^[a-zA-Z0-9-]{8,64}$/.test(given)) return given;
	return `forge-${panelId.replace(/[^a-zA-Z0-9]/g, '-')}`.slice(0, 64);
}

export function TerminalPanel({ panelId, params }: PanelProps): JSX.Element {
	const parsed = TerminalPresetIdSchema.safeParse(params['preset']);
	const preset: TerminalPresetId = parsed.success ? parsed.data : 'powershell';
	const sessionId = sessionIdFor(panelId, params);
	const presets = useQuery({ queryKey: PRESETS_KEY, queryFn: () => call('terminal:presets') });
	const info = presets.data?.find((p) => p.id === preset);
	const available = info?.available ?? false;
	const { settings } = useGeneralSettings();
	const hostRef = useRef<HTMLDivElement>(null);
	const { status, error } = useXterm(hostRef, {
		sessionId,
		preset,
		fontSize: settings.fontSize,
		enabled: available,
	});

	if (presets.isLoading) {
		return (
			<div className='flex h-full items-center justify-center bg-bg-1'>
				<Spinner label='Checking terminal tools' />
			</div>
		);
	}
	if (presets.error)
		return (
			<ErrorState message={presets.error.message} onRetry={() => void presets.refetch()} />
		);
	if (info && !info.available) {
		return (
			<div className='h-full bg-bg-1'>
				<EmptyState
					icon={<TerminalSquare size={22} />}
					title={`${info.label} isn't available`}
					description={
						<span className='flex flex-col items-center gap-2'>
							<span>{info.reason}</span>
							{info.installHint && (
								<span className='flex items-center gap-1'>
									<code className='selectable rounded-sm bg-bg-2 px-2 py-1 text-12 text-fg-0'>
										{info.installHint}
									</code>
									<Button
										size='sm'
										variant='ghost'
										icon={<Copy size={12} />}
										onClick={() => {
											void navigator.clipboard.writeText(
												info.installHint ?? '',
											);
											toast.success(
												'Copied',
												'Run it in a PowerShell terminal, then retry.',
											);
										}}
									>
										Copy
									</Button>
								</span>
							)}
						</span>
					}
					action={
						<Button size='sm' onClick={() => void presets.refetch()}>
							Check again
						</Button>
					}
				/>
			</div>
		);
	}
	if (status === 'error')
		return <ErrorState title='Terminal failed to start' message={error ?? 'Unknown error'} />;

	return (
		<div
			className='relative h-full bg-bg-1 p-1'
			data-terminal-session={sessionId}
			data-terminal-status={status}
		>
			<div ref={hostRef} className='h-full w-full' />
			{status === 'starting' && (
				<div className='absolute inset-0 flex items-center justify-center'>
					<Spinner label='Starting terminal' />
				</div>
			)}
		</div>
	);
}
