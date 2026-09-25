import type { RoomId } from './rooms';

/** A third-party site shown in a WebContentsView (no API, or a UI we'd rather not rebuild). */
export interface WebService {
	id: string;
	name: string;
	room: RoomId;
	url: string;
	/** Navigation and popups stay in-app only for these hosts (and their subdomains). */
	hosts: string[];
}

export const WEB_SERVICES: readonly WebService[] = [
	{
		id: 'tradingview',
		name: 'TradingView',
		room: 'trade',
		url: 'https://www.tradingview.com/chart/',
		hosts: ['tradingview.com'],
	},
	{
		// Solana memecoin terminal; wallet connection happens inside the site, never in Forge.
		id: 'axiom',
		name: 'Axiom',
		room: 'trade',
		url: 'https://axiom.trade/',
		hosts: ['axiom.trade'],
	},
	{
		id: 'fomo',
		name: 'Fomo',
		room: 'trade',
		url: 'https://fomo.family/',
		hosts: ['fomo.family'],
	},
	{
		id: 'forexfactory',
		name: 'Forex Factory',
		room: 'trade',
		url: 'https://www.forexfactory.com/calendar',
		hosts: ['forexfactory.com'],
	},
	// Hub: comms and socials. No APIs or user tokens for these (see CLAUDE.md §7): the real
	// sites, logged in inside their own partitions.
	{
		id: 'discord',
		name: 'Discord',
		room: 'hub',
		url: 'https://discord.com/app',
		hosts: ['discord.com', 'discordapp.com', 'discord.gg'],
	},
	{
		id: 'linkedin',
		name: 'LinkedIn',
		room: 'hub',
		url: 'https://www.linkedin.com/feed/',
		hosts: ['linkedin.com'],
	},
	{
		id: 'x',
		name: 'X',
		room: 'hub',
		url: 'https://x.com/home',
		hosts: ['x.com', 'twitter.com'],
	},
	{
		id: 'notion-web',
		name: 'Notion',
		room: 'hub',
		url: 'https://www.notion.so/',
		hosts: ['notion.so', 'notion.site'],
	},
];

export function getWebService(id: string): WebService | undefined {
	return WEB_SERVICES.find((s) => s.id === id);
}

export function isServiceHost(service: WebService, rawUrl: string): boolean {
	try {
		const url = new URL(rawUrl);
		if (url.protocol !== 'https:') return false;
		return service.hosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
	} catch {
		return false;
	}
}

export function partitionFor(serviceId: string): string {
	return `persist:svc-${serviceId}`;
}
