import type { JSX } from 'react';

import { ErrorState } from '../../ui/ErrorState';
import { Select } from '../../ui/Select';
import { Spinner } from '../../ui/Spinner';
import { Switch } from '../../ui/Switch';
import { useGeneralSettings } from '../hooks/use-general-settings';
import { SettingRow } from './SettingRow';

export function GeneralSettingsTab(): JSX.Element {
	const { settings, isLoading, error, update } = useGeneralSettings();

	if (isLoading) {
		return (
			<div className='flex h-40 items-center justify-center'>
				<Spinner />
			</div>
		);
	}
	if (error) return <ErrorState message={error.message} />;

	return (
		<div className='flex flex-col divide-y divide-border'>
			<SettingRow
				label='UI font size'
				description='Base size for the whole interface.'
				htmlFor='font-size'
			>
				<Select
					aria-label='UI font size'
					value={String(settings.fontSize)}
					onValueChange={(v) => update({ fontSize: Number(v) as 12 | 13 | 14 })}
					options={[
						{ value: '12', label: '12 px — compact' },
						{ value: '13', label: '13 px — default' },
						{ value: '14', label: '14 px — comfortable' },
					]}
				/>
			</SettingRow>
			<SettingRow
				label='Reduce motion'
				description='Disables animations. The OS setting is always respected too.'
				htmlFor='reduce-motion'
			>
				<Switch
					id='reduce-motion'
					aria-label='Reduce motion'
					checked={settings.reduceMotion}
					onCheckedChange={(reduceMotion) => update({ reduceMotion })}
				/>
			</SettingRow>
		</div>
	);
}
