import {
	useMutation,
	type UseMutationResult,
	useQuery,
	useQueryClient,
	type UseQueryResult,
} from '@tanstack/react-query';

import type { JournalEntry } from '@shared/ipc/channels/journal';

import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';

const KEY = ['journal', 'entries'] as const;

export function useJournal(): UseQueryResult<JournalEntry[]> {
	return useQuery({ queryKey: KEY, queryFn: () => call('journal:list') });
}

/** Writes one entry into the cached list (newest first), as main returns it. */
function useUpsert(): (entry: JournalEntry) => void {
	const client = useQueryClient();
	return (entry) =>
		client.setQueryData<JournalEntry[]>(KEY, (list = []) => [
			entry,
			...list.filter((e) => e.id !== entry.id),
		]);
}

export function useSaveEntry(): UseMutationResult<JournalEntry, Error, JournalEntry> {
	const upsert = useUpsert();
	return useMutation({
		mutationFn: (entry: JournalEntry) => call('journal:save', entry),
		onSuccess: upsert,
		onError: (e) => toast.error('Could not save the entry', e.message),
	});
}

export function useDeleteEntry(): UseMutationResult<void, Error, string> {
	const client = useQueryClient();
	return useMutation({
		mutationFn: (id: string) => call('journal:delete', id),
		onSuccess: (_, id) =>
			client.setQueryData<JournalEntry[]>(KEY, (list = []) =>
				list.filter((e) => e.id !== id),
			),
		onError: (e) => toast.error('Could not delete the entry', e.message),
	});
}

export type ImageAction =
	| {
			kind: 'paste';
			entryId: string;
			mime: 'image/png' | 'image/jpeg' | 'image/webp';
			base64: string;
	  }
	| { kind: 'pick'; entryId: string }
	| { kind: 'remove'; entryId: string; file: string };

export function useImageAction(): UseMutationResult<JournalEntry, Error, ImageAction> {
	const upsert = useUpsert();
	return useMutation({
		mutationFn: (a: ImageAction) => {
			if (a.kind === 'paste') {
				return call('journal:addImage', {
					entryId: a.entryId,
					mime: a.mime,
					base64: a.base64,
				});
			}
			if (a.kind === 'pick') return call('journal:pickImages', a.entryId);
			return call('journal:removeImage', { entryId: a.entryId, file: a.file });
		},
		onSuccess: upsert,
		onError: (e) => toast.error('Screenshot failed', e.message),
	});
}

export function useImage(entryId: string, file: string): UseQueryResult<string> {
	return useQuery({
		queryKey: ['journal', 'image', entryId, file],
		queryFn: () => call('journal:image', { entryId, file }),
		// Files never change under a name, so a loaded screenshot stays valid.
		staleTime: Infinity,
		gcTime: 5 * 60_000,
	});
}

/** Reads a pasted/dropped image as base64 without the data: prefix. */
export function fileToBase64(file: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = () => {
			const url = String(reader.result);
			resolve(url.slice(url.indexOf(',') + 1));
		};
		reader.onerror = () => reject(reader.error ?? new Error('Could not read the image'));
		reader.readAsDataURL(file);
	});
}
