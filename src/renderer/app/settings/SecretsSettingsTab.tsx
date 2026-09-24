import { useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound } from 'lucide-react';
import type { JSX } from 'react';

import { call } from '../../lib/ipc';
import { EmptyState } from '../../ui/EmptyState';
import { ErrorState } from '../../ui/ErrorState';
import { Spinner } from '../../ui/Spinner';
import { useModules } from '../hooks/use-modules';
import { SecretRow } from './SecretRow';

export const SAVED_SECRETS_KEY = ['secrets', 'saved'] as const;

export function SecretsSettingsTab(): JSX.Element {
	const client = useQueryClient();
	const { modules, isLoading: modulesLoading, error: modulesError } = useModules();
	const saved = useQuery({
		queryKey: SAVED_SECRETS_KEY,
		queryFn: () => call('secrets:listSaved'),
	});

	if (modulesLoading || saved.isLoading) {
		return (
			<div className='flex h-40 items-center justify-center'>
				<Spinner />
			</div>
		);
	}
	const error = modulesError ?? saved.error;
	if (error) return <ErrorState message={error.message} onRetry={() => void saved.refetch()} />;

	const specs = modules.flatMap((m) =>
		m.requiredSecrets.map((s) => ({ ...s, moduleName: m.name, moduleEnabled: m.enabled })),
	);
	if (specs.length === 0) {
		return (
			<EmptyState
				icon={<KeyRound size={20} />}
				title='No secrets needed yet'
				description='Modules that need API keys (GitHub, Vercel, AI providers…) will list them here.'
			/>
		);
	}

	const savedSet = new Set(saved.data ?? []);
	return (
		<div className='flex flex-col gap-2'>
			<p className='text-12 text-fg-2'>
				Encrypted with Windows DPAPI and stored only in the main process. Values are never
				shown again or sent to the UI.
			</p>
			<ul className='divide-y divide-border rounded-sm border border-border'>
				{specs.map((spec) => (
					<SecretRow
						key={spec.key}
						spec={spec}
						isSaved={savedSet.has(spec.key)}
						onChanged={() =>
							void client.invalidateQueries({ queryKey: SAVED_SECRETS_KEY })
						}
					/>
				))}
			</ul>
		</div>
	);
}
