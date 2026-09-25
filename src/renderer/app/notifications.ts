import type { ForgeNotification } from '@shared/notifications';

import { call } from '../lib/ipc';
import { rlog } from '../lib/log';
import { useForgeEvent } from '../lib/use-forge-event';
import { toast } from '../stores/toast-store';
import { commandContext } from './commands/use-commands';

export const INBOX_PANEL = 'inbox.main';

/** Click-through: mark read, then go to the notification's panel (or the inbox). */
export function openNotification(n: ForgeNotification): void {
	if (!n.read) {
		call('notifications:markRead', n.id).catch((error: unknown) =>
			rlog.warn('notifications', 'markRead failed', error),
		);
	}
	if (n.target) {
		commandContext.openPanel(
			n.target.panelId,
			n.target.params ? { params: n.target.params } : {},
		);
	} else {
		commandContext.openPanel(INBOX_PANEL);
	}
}

/** Mounted once in the shell: in-app toasts for new problems, Windows-toast click-through. */
export function useNotificationEvents(): void {
	useForgeEvent('notifications:added', (n) => {
		// Unfocused, main raises a Windows toast instead.
		if (!document.hasFocus()) return;
		if (n.level === 'warn') toast.warn(n.title, n.body || undefined);
		if (n.level === 'error') toast.error(n.title, n.body || undefined);
	});
	useForgeEvent('notifications:activated', openNotification);
}
