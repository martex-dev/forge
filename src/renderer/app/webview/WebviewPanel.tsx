import { ArrowLeft, ExternalLink, Globe, Home, RotateCw } from 'lucide-react';
import { type JSX, useEffect, useRef, useState } from 'react';

import type { WebviewState } from '@shared/ipc/channels/webview';
import type { RoomId } from '@shared/rooms';
import { getWebService } from '@shared/webviews';

import { call } from '../../lib/ipc';
import { rlog } from '../../lib/log';
import { useForgeEvent } from '../../lib/use-forge-event';
import { useAnyOverlayOpen } from '../../stores/overlay-store';
import { useUiStore } from '../../stores/ui-store';
import { ErrorState } from '../../ui/ErrorState';
import { IconButton } from '../../ui/IconButton';
import { Spinner } from '../../ui/Spinner';
import { useWebviewBounds } from './use-webview-bounds';

interface WebviewPanelProps {
	serviceId: string;
	instanceId: string;
	room: RoomId;
}

type Action = 'back' | 'reload' | 'home' | 'openExternal';

/** Reserves space for a native WebContentsView and drives it from the renderer. */
export function WebviewPanel({ serviceId, instanceId, room }: WebviewPanelProps): JSX.Element {
	const service = getWebService(serviceId);
	const hostRef = useRef<HTMLDivElement>(null);
	const [state, setState] = useState<WebviewState | null>(null);
	const [attachError, setAttachError] = useState<string | null>(null);

	const roomActive = useUiStore((s) => s.room === room && !s.playgroundOpen);
	const overlayOpen = useAnyOverlayOpen();
	// Native views paint above all HTML, so they must vanish whenever an overlay is open.
	const wantVisible = roomActive && !overlayOpen && !state?.error;

	useEffect(() => {
		let cancelled = false;
		call('webview:attach', { instanceId, serviceId })
			.then((s) => {
				if (!cancelled) setState(s);
			})
			.catch((error: unknown) => {
				rlog.error('webview', `attach failed for ${serviceId}`, error);
				if (!cancelled)
					setAttachError(error instanceof Error ? error.message : String(error));
			});
		return () => {
			cancelled = true;
			call('webview:detach', instanceId).catch((error: unknown) =>
				rlog.warn('webview', 'detach failed', error),
			);
		};
	}, [instanceId, serviceId]);

	useForgeEvent('webview:state', (s) => {
		if (s.instanceId === instanceId) setState(s);
	});

	useWebviewBounds(instanceId, hostRef, wantVisible, state !== null);

	const act = (action: Action): void => {
		call('webview:navigate', { instanceId, action }).catch((error: unknown) =>
			rlog.warn('webview', `${action} failed`, error),
		);
	};

	if (!service) return <ErrorState message={`Unknown web service "${serviceId}"`} />;
	if (attachError)
		return <ErrorState title={`${service.name} unavailable`} message={attachError} />;

	return (
		<div className='flex h-full flex-col bg-bg-1'>
			<div className='flex h-8 shrink-0 items-center gap-1 border-b border-border px-1'>
				<IconButton
					size='sm'
					label='Back'
					icon={<ArrowLeft size={14} />}
					disabled={!state?.canGoBack}
					onClick={() => act('back')}
				/>
				<IconButton
					size='sm'
					label='Reload'
					icon={<RotateCw size={14} />}
					onClick={() => act('reload')}
				/>
				<IconButton
					size='sm'
					label={`${service.name} home`}
					icon={<Home size={14} />}
					onClick={() => act('home')}
				/>
				<div className='mx-1 flex min-w-0 flex-1 items-center gap-1.5 rounded-sm bg-bg-2 px-2 py-0.5 text-12 text-fg-2'>
					{state?.loading ? <Spinner size={12} /> : <Globe size={12} />}
					<span className='selectable truncate'>{state?.url ?? service.url}</span>
				</div>
				<IconButton
					size='sm'
					label='Open in browser'
					icon={<ExternalLink size={14} />}
					onClick={() => act('openExternal')}
				/>
			</div>
			<div ref={hostRef} className='relative min-h-0 flex-1' data-webview-host={instanceId}>
				{!state && (
					<div className='flex h-full items-center justify-center'>
						<Spinner label={`Loading ${service.name}`} />
					</div>
				)}
				{state?.error && (
					<ErrorState
						title={`${service.name} failed to load`}
						message={state.error}
						onRetry={() => act('reload')}
					/>
				)}
				{state && !state.error && overlayOpen && roomActive && (
					<div className='flex h-full items-center justify-center text-12 text-fg-2'>
						{service.name} is hidden while a dialog is open
					</div>
				)}
			</div>
		</div>
	);
}
