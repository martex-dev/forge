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
