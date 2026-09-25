import { describe, expect, it, vi } from 'vitest';

import type { ForgeNotification, NewNotification } from '@shared/notifications';

vi.mock('electron', () => ({
	BrowserWindow: { getAllWindows: () => [] },
	Notification: { isSupported: () => false },
}));
vi.mock('electron-log/main', () => ({ default: { warn: vi.fn(), error: vi.fn() } }));

const { createNotifier } = await import('./notify');

function repo(): { add(input: NewNotification): ForgeNotification; unreadCount(): number } {
	let n = 0;
	return {
		add: (input) => ({
			id: String(++n),
			module: input.module,
			title: input.title,
			body: input.body ?? '',
			level: input.level,
			read: false,
			createdAt: n,
			target: input.target ?? null,
		}),
		unreadCount: () => n,
	};
}

describe('notifier', () => {
	it('tells subscribers about every notification until they unsubscribe', () => {
		const notify = createNotifier(repo() as never);
		const seen: string[] = [];
		const stop = notify.subscribe((n) => seen.push(n.title));
		notify({ module: 'alerts', title: 'BTC above 100k', level: 'warn' });
		stop();
		notify({ module: 'alerts', title: 'ignored', level: 'info' });
		expect(seen).toEqual(['BTC above 100k']);
	});

	it('keeps going when a listener throws', () => {
		const notify = createNotifier(repo() as never);
		const seen: string[] = [];
		notify.subscribe(() => {
			throw new Error('boom');
		});
		notify.subscribe((n) => seen.push(n.id));
		expect(notify({ module: 'runs', title: 'done', level: 'success' }).id).toBe('1');
		expect(seen).toEqual(['1']);
	});
});
