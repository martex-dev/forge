import { describe, expect, it, vi } from 'vitest';

import { NOTION_VERSION, NotionClient } from './notion-client';

const PAGE = {
	id: '0123456789abcdef0123456789abcdef',
	url: 'https://www.notion.so/Plan-0123',
	last_edited_time: '2026-09-25T10:00:00.000Z',
	icon: { type: 'emoji', emoji: '🧪' },
	parent: { type: 'page_id', page_id: 'x' },
	properties: { title: { type: 'title', title: [{ plain_text: 'Plan' }] } },
};

function mock(routes: Record<string, () => Response>): { fetch: typeof fetch; calls: string[] } {
	const calls: string[] = [];
	const fetchImpl = vi.fn(async (url: string, init?: RequestInit) => {
		const path = url.replace('https://api.test', '');
		calls.push(`${init?.method ?? 'GET'} ${path}`);
		const headers = new Headers(init?.headers);
		expect(headers.get('Notion-Version')).toBe(NOTION_VERSION);
		expect(headers.get('Authorization')).toBe('Bearer tok');
		const route = Object.keys(routes).find((r) =>
			`${init?.method ?? 'GET'} ${path}`.startsWith(r),
		);
		return route ? (routes[route] as () => Response)() : new Response('{}', { status: 500 });
	});
	return { fetch: fetchImpl as unknown as typeof fetch, calls };
}

const json = (body: unknown, status = 200): Response =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('NotionClient', () => {
	it('searches pages and maps summaries', async () => {
		const m = mock({ 'POST /search': () => json({ results: [PAGE] }) });
		const [page] = await new NotionClient('tok', 'https://api.test', m.fetch).search('plan');
		expect(page).toMatchObject({
			title: 'Plan',
			icon: '🧪',
			parent: 'page',
			lastEdited: Date.UTC(2026, 8, 25, 10),
		});
	});

	it('reads a page with nested list children', async () => {
		const m = mock({
			'GET /pages/': () => json(PAGE),
			'GET /blocks/0123456789abcdef0123456789abcdef/children': () =>
				json({
					results: [
						{
							id: 'b1',
							type: 'bulleted_list_item',
							has_children: true,
							bulleted_list_item: { rich_text: [{ plain_text: 'parent' }] },
						},
					],
					has_more: false,
				}),
			'GET /blocks/b1/children': () =>
				json({
					results: [
						{
							id: 'b2',
							type: 'to_do',
							to_do: { rich_text: [{ plain_text: 'child' }], checked: false },
						},
					],
				}),
		});
		const page = await new NotionClient('tok', 'https://api.test', m.fetch).page(PAGE.id);
		expect(page.markdown).toBe('- parent\n   - [ ] child');
		expect(page.truncated).toBe(false);
	});

	it('explains the two usual failures', async () => {
		const c401 = mock({ 'POST /search': () => json({ message: 'bad' }, 401) });
		await expect(
			new NotionClient('tok', 'https://api.test', c401.fetch).search(''),
		).rejects.toThrow(/Settings → Secrets/);
		const c404 = mock({ 'GET /pages/': () => json({}, 404) });
		await expect(
			new NotionClient('tok', 'https://api.test', c404.fetch).page(PAGE.id),
		).rejects.toThrow(/Connections/);
	});

	it('appends a to-do block', async () => {
		let sent: unknown;
		const fetchImpl = (async (_url: string, init?: RequestInit) => {
			sent = JSON.parse(String(init?.body));
			return json({});
		}) as unknown as typeof fetch;
		await new NotionClient('tok', 'https://api.test', fetchImpl).append(
			PAGE.id,
			'to_do',
			'ship it',
		);
		expect(sent).toEqual({
			children: [
				{
					object: 'block',
					type: 'to_do',
					to_do: {
						rich_text: [{ type: 'text', text: { content: 'ship it' } }],
						checked: false,
					},
				},
			],
		});
	});
});
