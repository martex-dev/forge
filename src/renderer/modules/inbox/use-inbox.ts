import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ForgeNotification } from '@shared/notifications';

import { call } from '../../lib/ipc';
import { useForgeEvent } from '../../lib/use-forge-event';
import { toast } from '../../stores/toast-store';

const LIST_KEY = ['notifications', 'list'] as const;

export function useNotifications(): {
	list: ForgeNotification[];
	isLoading: boolean;
	error: Error | null;
	refetch: () => void;
} {
	const client = useQueryClient();
	const query = useQuery({ queryKey: LIST_KEY, queryFn: () => call('notifications:list') });
	// Any add / read / delete anywhere (other panels, main) changes the unread count.
	useForgeEvent(
		'notifications:changed',
		() => void client.invalidateQueries({ queryKey: LIST_KEY }),
	);
	return {
		list: query.data ?? [],
		isLoading: query.isLoading,
		error: query.error,
		refetch: () => void query.refetch(),
	};
}

export function useInboxActions(): { markAllRead: () => void; clearRead: () => void } {
	const markAll = useMutation({
		mutationFn: () => call('notifications:markAllRead'),
		onError: (error) => toast.error('Could not mark as read', error.message),
	});
	const clear = useMutation({
		mutationFn: () => call('notifications:deleteRead'),
		onSuccess: (removed) =>
			toast.info(
				removed === 0 ? 'Nothing to clear' : `Cleared ${removed} read notification(s)`,
			),
		onError: (error) => toast.error('Could not clear notifications', error.message),
	});
	return { markAllRead: () => markAll.mutate(), clearRead: () => clear.mutate() };
}
