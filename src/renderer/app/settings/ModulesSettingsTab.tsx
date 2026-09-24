import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Blocks } from 'lucide-react';
import type { JSX } from 'react';

import type { ModuleInfo } from '@shared/modules/types';
import { ROOMS } from '@shared/rooms';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import { Badge } from '../../ui/Badge';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { Switch } from '../../ui/Switch';
import { MODULES_KEY, useModules } from '../hooks/use-modules';

const PLATFORM_NAMES: Record<string, string> = {
	win32: 'Windows',
	darwin: 'macOS',
	linux: 'Linux',
};

function platformNote(m: ModuleInfo): string | null {
	if (!m.platforms) return null;
	const names = m.platforms.map((p) => PLATFORM_NAMES[p] ?? p).join(', ');
	return m.supported ? `${names} only` : `Not available on this OS (${names} only)`;
}

export function ModulesSettingsTab(): JSX.Element {
	const client = useQueryClient();
	const { modules, isLoading, error } = useModules();
	const toggle = useMutation({
		mutationFn: (input: { id: string; enabled: boolean }) => call('modules:setEnabled', input),
		onSuccess: (list) => client.setQueryData(MODULES_KEY, list),
		onError: (err) => toast.error('Could not change module', err.message),
	});

	if (isLoading) {
		return (
			<div className='flex h-40 items-center justify-center'>
				<Spinner />
			</div>
		);
	}
	if (error) return <ErrorState message={error.message} />;
	if (modules.length === 0) {
		return <EmptyState icon={<Blocks size={20} />} title='No modules installed' />;
	}

	const groups = [
		{ id: 'global', name: 'Global' },
		...ROOMS.map((r) => ({ id: r.id, name: r.name })),
	]
		.map((g) => ({ ...g, items: modules.filter((m) => m.room === g.id) }))
		.filter((g) => g.items.length > 0);

	return (
		<div className='flex flex-col gap-4'>
			{groups.map((group) => (
				<section key={group.id}>
					<h3 className='mb-1 text-11 font-medium tracking-widest text-fg-2 uppercase'>
						{group.name}
					</h3>
					<ul className='divide-y divide-border rounded-sm border border-border'>
						{group.items.map((m) => {
							const note = platformNote(m);
							return (
								<li key={m.id} className='flex items-center gap-3 px-3 py-2'>
									<div className='min-w-0 flex-1'>
										<div className='flex items-center gap-2'>
											<span className='text-13 font-medium text-fg-0'>
												{m.name}
											</span>
											{note && (
												<Badge tone={m.supported ? 'info' : 'warn'}>
													{note}
												</Badge>
											)}
											{m.requiredSecrets.length > 0 && (
												<Badge>{m.requiredSecrets.length} secret(s)</Badge>
											)}
										</div>
										<p className='text-12 text-fg-2'>{m.description}</p>
									</div>
									<Switch
										aria-label={`Enable ${m.name}`}
										checked={m.enabled}
										disabled={!m.supported || toggle.isPending}
										onCheckedChange={(enabled) =>
											toggle.mutate({ id: m.id, enabled })
										}
									/>
								</li>
							);
						})}
					</ul>
				</section>
			))}
		</div>
	);
}
