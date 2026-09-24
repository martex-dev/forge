import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			// IPC is local and cheap; data changes are pushed via events, not polled.
			staleTime: Infinity,
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});
