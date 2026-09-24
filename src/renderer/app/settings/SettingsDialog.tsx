import type { JSX } from 'react';

import { type SettingsTab, useUiStore } from '../../stores/ui-store';
import { Dialog } from '../../ui/Dialog';
import { Tabs } from '../../ui/Tabs';
import { GeneralSettingsTab } from './GeneralSettingsTab';
import { ModulesSettingsTab } from './ModulesSettingsTab';
import { SecretsSettingsTab } from './SecretsSettingsTab';

export function SettingsDialog(): JSX.Element {
	const open = useUiStore((s) => s.settingsOpen);
	const setOpen = useUiStore((s) => s.setSettingsOpen);
	const tab = useUiStore((s) => s.settingsTab);
	const setTab = useUiStore((s) => s.setSettingsTab);

	return (
		<Dialog open={open} onOpenChange={setOpen} title='Settings' width='lg'>
			<div className='-mx-4 -my-3 h-[60vh]'>
				<Tabs
					aria-label='Settings sections'
					orientation='vertical'
					value={tab}
					onValueChange={(v) => setTab(v as SettingsTab)}
					className='h-full'
					items={[
						{
							value: 'general',
							label: 'General',
							content: (
								<Pane>
									<GeneralSettingsTab />
								</Pane>
							),
						},
						{
							value: 'secrets',
							label: 'Secrets',
							content: (
								<Pane>
									<SecretsSettingsTab />
								</Pane>
							),
						},
						{
							value: 'modules',
							label: 'Modules',
							content: (
								<Pane>
									<ModulesSettingsTab />
								</Pane>
							),
						},
					]}
				/>
			</div>
		</Dialog>
	);
}

function Pane({ children }: { children: JSX.Element }): JSX.Element {
	return <div className='px-4 py-2'>{children}</div>;
}
