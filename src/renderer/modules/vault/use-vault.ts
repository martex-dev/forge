import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';

import type { NoteMeta, SearchHit, VaultInfo } from '@shared/ipc/channels/vault';

import { commandContext } from '../../app/commands/use-commands';
import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';
import { toast } from '../../stores/toast-store';

export const NOTE_PANEL = 'vault.note';
const INFO_KEY = ['vault', 'info'] as const;

/** UI state shared by the sidebar and note panel. */
export const useVaultUi = create<{
	activePath: string | null;
	view: 'files' | 'search' | 'tags';
	tag: string | null;
	setActivePath: (path: string | null) => void;
	showTag: (tag: string) => void;
	setView: (view: 'files' | 'search' | 'tags') => void;
}>((set) => ({
	activePath: null,
	view: 'files',
	tag: null,
	setActivePath: (activePath) => set({ activePath }),
	showTag: (tag) => set({ view: 'tags', tag }),
	setView: (view) => set({ view }),
}));

export function openNote(path: string): void {
	const title = path.slice(path.lastIndexOf('/') + 1).replace(/\.md$/i, '');
	commandContext.openPanel(NOTE_PANEL, { title, params: { path } });
}

/** Keeps every vault query fresh when notes change on disk (Obsidian, sync, our own saves). */
export function useVaultEvents(): void {
	const client = useQueryClient();
	useForgeEvent('vault:changed', ({ full }) => {
		void client.invalidateQueries({ queryKey: full ? ['vault'] : ['vault', 'index'] });
		if (full) void client.invalidateQueries({ queryKey: INFO_KEY });
	});
}

export function useVaultInfo(): {
	info: VaultInfo | undefined;
	isLoading: boolean;
	error: Error | null;
} {
	const query = useQuery({ queryKey: INFO_KEY, queryFn: () => call('vault:info') });
	return { info: query.data, isLoading: query.isLoading, error: query.error };
}

export function useVaultActions(): { choose: () => void; close: () => void } {
	const client = useQueryClient();
	const onSuccess = (info: VaultInfo): void => {
		client.setQueryData(INFO_KEY, info);
		void client.invalidateQueries({ queryKey: ['vault', 'index'] });
	};
	const choose = useMutation({
		mutationFn: () => call('vault:openDialog'),
		onSuccess,
		onError: (error) => toast.error('Could not open vault', error.message),
	});
	const close = useMutation({ mutationFn: () => call('vault:close'), onSuccess });
	return { choose: () => choose.mutate(), close: () => close.mutate() };
}

// Everything derived from the note index lives under ['vault', 'index'] for one-shot invalidation.
export function useNotes(enabled: boolean): {
	notes: NoteMeta[];
	isLoading: boolean;
	error: Error | null;
} {
	const query = useQuery({
		queryKey: ['vault', 'index', 'notes'],
		queryFn: () => call('vault:notes'),
		enabled,
	});
	return { notes: query.data ?? [], isLoading: query.isLoading, error: query.error };
}

export function useTags(enabled: boolean): Array<{ tag: string; count: number }> {
	return (
		useQuery({
			queryKey: ['vault', 'index', 'tags'],
			queryFn: () => call('vault:tags'),
			enabled,
		}).data ?? []
	);
}

export function useSearch(q: string): {
	hits: SearchHit[];
	isFetching: boolean;
	error: Error | null;
} {
	const query = useQuery({
		queryKey: ['vault', 'index', 'search', q],
		queryFn: () => call('vault:search', q),
		enabled: q.trim().length > 0,
		placeholderData: (prev) => prev,
	});
	return { hits: query.data ?? [], isFetching: query.isFetching, error: query.error };
}

export function useBacklinks(path: string): NoteMeta[] {
	return (
		useQuery({
			queryKey: ['vault', 'index', 'backlinks', path],
			queryFn: () => call('vault:backlinks', path),
		}).data ?? []
	);
}

/** Resolve [[target]] from a note and open it; offers to create missing notes like Obsidian. */
export async function followWikilink(target: string, from: string): Promise<void> {
	try {
		const path = await call('vault:resolve', { target, from });
		if (path) {
			openNote(path);
			return;
		}
		const folder = from.includes('/') ? from.slice(0, from.lastIndexOf('/')) : '';
		const created = await call('vault:create', {
			folder,
			name: target.split('/').pop() ?? target,
		});
		toast.info('Created note', created);
		openNote(created);
	} catch (error) {
		toast.error('Could not open link', error instanceof Error ? error.message : String(error));
	}
}
