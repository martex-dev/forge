import type { ForgeNotification, NotificationLevel } from '@shared/notifications';

import { ForgeError } from '../../core/errors';

export interface WebhookMeta {
	name: string | null;
	channelId: string | null;
}

export interface DiscordPayload {
	content?: string;
	username: string;
	embeds?: Array<{
		title: string;
		description?: string;
		color: number;
		footer?: { text: string };
		timestamp?: string;
	}>;
	allowed_mentions: { parse: string[] };
}

type Fetch = typeof fetch;

const DISCORD_ORIGIN = /^https:\/\/(?:(?:ptb|canary)\.)?discord(?:app)?\.com/;

/** e2e only: point webhook calls at a local mock (FORGE_DISCORD_API, honoured with FORGE_E2E=1). */
export function resolveUrl(url: string): string {
	const mock = process.env['FORGE_E2E'] === '1' ? process.env['FORGE_DISCORD_API'] : undefined;
	return mock ? url.replace(DISCORD_ORIGIN, mock.replace(/\/$/, '')) : url;
}

// Discord embed colours are integers; these match the design tokens' hues.
const LEVEL_COLOR: Record<NotificationLevel, number> = {
	info: 0x60a5fa,
	success: 0x22c55e,
	warn: 0xf59e0b,
	error: 0xef4444,
};

export function notificationPayload(n: ForgeNotification): DiscordPayload {
	return {
		username: 'Forge',
		embeds: [
			{
				title: n.title.slice(0, 256),
				...(n.body ? { description: n.body.slice(0, 4000) } : {}),
				color: LEVEL_COLOR[n.level],
				footer: { text: n.module },
				timestamp: new Date(n.createdAt).toISOString(),
			},
		],
		// Never ping anyone from an automated message (@everyone in an alert body, say).
		allowed_mentions: { parse: [] },
	};
}

export function textPayload(content: string): DiscordPayload {
	return { content, username: 'Forge', allowed_mentions: { parse: [] } };
}

/** Thrown errors never include the URL: it carries the webhook token. */
function httpError(status: number, detail: string): ForgeError {
	if (status === 401 || status === 404) {
		return new ForgeError('DISCORD_WEBHOOK_GONE', 'Discord says this webhook no longer exists');
	}
	return new ForgeError(
		'DISCORD_HTTP',
		`Discord returned HTTP ${status}${detail ? `: ${detail}` : ''}`,
	);
}

export async function fetchMeta(url: string, fetchImpl: Fetch = fetch): Promise<WebhookMeta> {
	const res = await fetchImpl(resolveUrl(url), { signal: AbortSignal.timeout(10_000) });
	if (!res.ok) throw httpError(res.status, '');
	const body = (await res.json()) as { name?: unknown; channel_id?: unknown };
	return {
		name: typeof body.name === 'string' ? body.name : null,
		channelId: typeof body.channel_id === 'string' ? body.channel_id : null,
	};
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Posts one message per webhook at a time (a per-webhook promise chain), and waits out a 429 once
 * using Discord's retry_after, so a burst of alerts is delivered instead of dropped.
 */
export class DiscordPoster {
	private readonly chains = new Map<string, Promise<void>>();

	constructor(private readonly fetchImpl: Fetch = fetch) {}

	post(key: string, url: string, payload: DiscordPayload): Promise<void> {
		const previous = this.chains.get(key) ?? Promise.resolve();
		const next = previous.catch(() => undefined).then(() => this.send(url, payload, true));
		this.chains.set(key, next);
		return next;
	}

	private async send(url: string, payload: DiscordPayload, retry: boolean): Promise<void> {
		const res = await this.fetchImpl(resolveUrl(url), {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify(payload),
			signal: AbortSignal.timeout(10_000),
		});
		if (res.status === 429 && retry) {
			const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
			await sleep(Math.min(10, body.retry_after ?? 1) * 1000);
			return this.send(url, payload, false);
		}
		if (!res.ok) {
			const detail = await res.text().catch(() => '');
			throw httpError(res.status, detail.slice(0, 200));
		}
	}
}
