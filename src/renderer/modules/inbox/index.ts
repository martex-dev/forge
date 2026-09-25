import { Bell, CheckCheck } from 'lucide-react';

import { manifest } from '@shared/modules/inbox.manifest';

import { INBOX_PANEL } from '../../app/notifications';
import { call } from '../../lib/ipc';
import { toast } from '../../stores/toast-store';
import type { RendererModule } from '../types';
import { InboxPanel } from './InboxPanel';

export const rendererModule: RendererModule = {
	manifest,
	panels: [
		{
			id: INBOX_PANEL,
			title: 'Inbox',
			room: 'hub',
			icon: Bell,
			component: InboxPanel,
			defaultOpen: true,
			position: 'right',
			initialSize: 380,
		},
	],
	commands: [
		{
			id: 'inbox.show',
			title: 'Hub: Show Inbox',
			room: 'hub',
			keywords: ['notifications', 'alerts', 'inbox'],
			icon: Bell,
			run: (ctx) => ctx.openPanel(INBOX_PANEL),
		},
		{
			id: 'inbox.markAllRead',
			title: 'Hub: Mark All Notifications Read',
			room: 'hub',
			keywords: ['notifications', 'read', 'clear'],
			icon: CheckCheck,
			run: async () => {
				await call('notifications:markAllRead');
				toast.success('All notifications marked read');
			},
		},
	],
};
