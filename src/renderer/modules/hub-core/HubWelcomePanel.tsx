import { Library } from 'lucide-react';
import type { JSX } from 'react';

import { RoomWelcome } from '../../rooms/RoomWelcome';

export function HubWelcomePanel(): JSX.Element {
	return (
		<RoomWelcome
			room='hub'
			icon={Library}
			heading='Hub'
			tagline='Knowledge and comms: notes, inbox and the day at a glance.'
			items={[
				{
					title: 'Obsidian vault',
					detail: 'Tree, editor/preview, wikilinks, search, quick note.',
					phase: 1,
				},
				{
					title: 'Notification inbox',
					detail: 'Every module reports here; Windows toasts.',
					phase: 1,
				},
				{ title: 'Notion', detail: 'Search, open and edit pages.', phase: 5 },
				{
					title: 'Discord + socials',
					detail: 'Webhooks and webview tabs, no self-bots.',
					phase: 5,
				},
				{
					title: '"Today" dashboard',
					detail: 'Events, PRs, P/L, runs, daily note.',
					phase: 5,
				},
			]}
		/>
	);
}
