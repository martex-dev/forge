import { describe, expect, it, vi } from 'vitest';

import { WebhookUrlSchema } from '@shared/ipc/channels/discord';
import type { ForgeNotification } from '@shared/notifications';

import { DiscordPoster, notificationPayload } from './discord-client';

vi.mock('electron', () => ({}));
const { shouldForward, DEFAULT_RULE } = await import('./index');

const note = (over: Partial<ForgeNotification> = {}): ForgeNotification => ({
	id: '1',
	module: 'alerts',
	title: 'BTCUSDT crossed 100,000',
	body: '@everyone look',
	level: 'warn',
	read: false,
	createdAt: Date.UTC(2026, 8, 25),
	target: null,
	...over,
});

describe('discord', () => {
	it('accepts only Discord webhook URLs', () => {
		const ok = 'https://discord.com/api/webhooks/123456/abcDEF-_x';
		expect(WebhookUrlSchema.safeParse(ok).success).toBe(true);
		expect(
			WebhookUrlSchema.safeParse('https://ptb.discord.com/api/v10/webhooks/1/x').success,
		).toBe(true);
		expect(WebhookUrlSchema.safeParse('https://evil.com/api/webhooks/1/x').success).toBe(false);
		expect(WebhookUrlSchema.safeParse('http://discord.com/api/webhooks/1/x').success).toBe(
			false,
		);
		expect(WebhookUrlSchema.safeParse(`${ok}/../../users`).success).toBe(false);
	});

	it('forwards by level and module, never its own notices', () => {
		const rule = { ...DEFAULT_RULE, enabled: true };
		expect(shouldForward(DEFAULT_RULE, note())).toBe(false); // off by default
		expect(shouldForward(rule, note())).toBe(true);
		expect(shouldForward(rule, note({ level: 'info' }))).toBe(false);
		expect(shouldForward({ ...rule, modules: ['runs'] }, note())).toBe(false);
		expect(shouldForward(rule, note({ module: 'discord', level: 'error' }))).toBe(false);
	});

	it('builds embeds that never ping anyone', () => {
		const p = notificationPayload(note());
		expect(p.allowed_mentions).toEqual({ parse: [] });
		expect(p.embeds?.[0]).toMatchObject({
			title: 'BTCUSDT crossed 100,000',
			footer: { text: 'alerts' },
		});
	});

	it('posts in order per webhook and waits out one 429', async () => {
		const calls: string[] = [];
		let first = true;
		const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
			calls.push(String(init?.body));
			if (first) {
				first = false;
				return new Response(JSON.stringify({ retry_after: 0.01 }), { status: 429 });
			}
			return new Response(null, { status: 204 });
		});
		const poster = new DiscordPoster(fetchImpl as unknown as typeof fetch);
		await Promise.all([
			poster.post('a', 'https://x', {
				username: 'Forge',
				content: 'one',
				allowed_mentions: { parse: [] },
			}),
			poster.post('a', 'https://x', {
				username: 'Forge',
				content: 'two',
				allowed_mentions: { parse: [] },
			}),
		]);
		expect(calls.map((b) => (JSON.parse(b) as { content: string }).content)).toEqual([
			'one',
			'one',
			'two',
		]);
	});

	it('reports a deleted webhook without leaking its URL', async () => {
		const poster = new DiscordPoster(
			(async () => new Response('', { status: 404 })) as unknown as typeof fetch,
		);
		const err = await poster
			.post('a', 'https://discord.com/api/webhooks/1/SECRET', {
				username: 'Forge',
				allowed_mentions: { parse: [] },
			})
			.then(() => null)
			.catch((e: unknown) => e as Error);
		expect(err?.message).toMatch(/no longer exists/);
		expect(err?.message).not.toContain('SECRET');
	});
});
