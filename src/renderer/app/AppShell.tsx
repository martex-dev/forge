import { type JSX, useEffect, useMemo } from 'react';

import { ROOMS } from '@shared/rooms';

import { panelsFor, RENDERER_MODULES } from '../modules/registry';
import { useUiStore } from '../stores/ui-store';
import { ErrorState } from '../ui/ErrorState';
import { Spinner } from '../ui/Spinner';
import { CommandPalette } from './CommandPalette';
import { useCommands } from './commands/use-commands';
import { useGlobalShortcuts } from './commands/use-global-shortcuts';
import { DesignPlayground } from './DesignPlayground';
import { useFsInvalidation } from './hooks/use-fs-invalidation';
import { useApplyGeneralSettings } from './hooks/use-general-settings';
import { useModules } from './hooks/use-modules';
import { useSidecarRecovery } from './hooks/use-sidecar-recovery';
import { RoomLayout } from './layout/RoomLayout';
import { RoomRail } from './RoomRail';
import { SettingsDialog } from './settings/SettingsDialog';
import { StatusBar } from './StatusBar';
import { TitleBar } from './TitleBar';

export function AppShell(): JSX.Element {
	const room = useUiStore((s) => s.room);
	const playgroundOpen = useUiStore((s) => s.playgroundOpen);
	// Layouts must not mount before the module list is known, or the first load would look like
	// "modules were just enabled" and re-open default panels over the saved layout.
	const { enabled, isLoading, error, refetch } = useModules();
	const commands = useCommands();

	useGlobalShortcuts(commands);
	useApplyGeneralSettings();
	useFsInvalidation();
	useSidecarRecovery();

	useEffect(() => {
		document.documentElement.dataset['room'] = room;
	}, [room]);

	const enabledPanels = useMemo(() => panelsFor(RENDERER_MODULES, enabled), [enabled]);

	return (
		<div className='flex h-full flex-col bg-bg-0'>
			<TitleBar />
			<div className='flex min-h-0 flex-1'>
				<RoomRail />
				<main className='relative min-w-0 flex-1'>
					{isLoading && (
						<div className='flex h-full items-center justify-center'>
							<Spinner size={24} label='Loading modules' />
						</div>
					)}
					{error && (
						<ErrorState
							title='Could not load modules'
							message={error.message}
							onRetry={() => void refetch()}
						/>
					)}
					{!isLoading &&
						!error &&
						ROOMS.map((r) => (
							<RoomLayout
								key={r.id}
								room={r.id}
								active={r.id === room && !playgroundOpen}
								panels={enabledPanels.filter((p) => p.room === r.id)}
							/>
						))}
					{playgroundOpen && (
						<div className='absolute inset-0 z-10'>
							<DesignPlayground />
						</div>
					)}
				</main>
			</div>
			<StatusBar />
			<CommandPalette commands={commands} />
			<SettingsDialog />
		</div>
	);
}
