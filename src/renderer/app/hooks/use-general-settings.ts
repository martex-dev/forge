import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { DEFAULT_GENERAL, type GeneralSettings } from '@shared/settings';

import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';
import { toast } from '../../stores/toast-store';

const KEY = ['settings', 'general'] as const;

export function useGeneralSettings(): {
	settings: GeneralSettings;
	isLoading: boolean;
	error: Error | null;
	update: (patch: Partial<GeneralSettings>) => void;
} {
	const client = useQueryClient();
	const query = useQuery({ queryKey: KEY, queryFn: () => call('settings:getGeneral') });
	useForgeEvent('settings:generalChanged', (next) => client.setQueryData(KEY, next));
	const mutation = useMutation({
		mutationFn: (patch: Partial<GeneralSettings>) => call('settings:updateGeneral', patch),
		onSuccess: (next) => client.setQueryData(KEY, next),
		onError: (error) => toast.error('Could not save settings', error.message),
	});
	return {
		settings: query.data ?? DEFAULT_GENERAL,
		isLoading: query.isLoading,
		error: query.error,
		update: mutation.mutate,
	};
}

/** Applies general settings to the document (font size, reduced motion). */
export function useApplyGeneralSettings(): void {
	const { settings } = useGeneralSettings();
	useEffect(() => {
		const root = document.documentElement;
		root.style.setProperty('--ui-font-size', `${settings.fontSize}px`);
		root.dataset['reduceMotion'] = String(settings.reduceMotion);
	}, [settings.fontSize, settings.reduceMotion]);
}
