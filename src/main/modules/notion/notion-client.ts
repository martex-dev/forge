import type { NotionPage, NotionPageSummary } from '@shared/ipc/channels/notion';

import { ForgeError } from '../../core/errors';
import { blocksToMarkdown, pageTitle } from './blocks';

type Json = Record<string, unknown>;
type Fetch = typeof fetch;

// A dated version pins the API's shapes; bump deliberately.
export const NOTION_VERSION = '2022-06-28';
const MAX_BLOCKS = 400;
// Children are fetched for these (lists and toggles nest; columns and synced blocks are skipped).
const NESTED = new Set([
	'bulleted_list_item',
	'numbered_list_item',
	'to_do',
	'toggle',
	'quote',
	'callout',
]);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export function toSummary(page: Json): NotionPageSummary {
	const icon = page['icon'] as { type?: string; emoji?: string } | null | undefined;
	const parentType = String((page['parent'] as Json | undefined)?.['type'] ?? 'workspace');
	return {
		id: String(page['id']),
		title: pageTitle(page),
		icon: icon?.type === 'emoji' ? (icon.emoji ?? null) : null,
		url: String(page['url'] ?? ''),
		lastEdited: Date.parse(String(page['last_edited_time'] ?? '')) || 0,
		parent:
			parentType === 'page_id'
				? 'page'
				: parentType === 'database_id'
					? 'database'
					: parentType === 'block_id'
						? 'block'
						: 'workspace',
	};
}

export class NotionClient {
	constructor(
		private readonly token: string,
		private readonly base = 'https://api.notion.com/v1',
		private readonly fetchImpl: Fetch = fetch,
	) {}

	private async request(
		method: string,
		path: string,
		body?: unknown,
		retry = true,
	): Promise<Json> {
		const res = await this.fetchImpl(`${this.base}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${this.token}`,
				'Notion-Version': NOTION_VERSION,
				'content-type': 'application/json',
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			signal: AbortSignal.timeout(15_000),
		});
		if (res.status === 429 && retry) {
			// Notion allows ~3 requests/s; Retry-After is in seconds.
			await sleep(Math.min(10, Number(res.headers.get('retry-after') ?? 1)) * 1000);
			return this.request(method, path, body, false);
		}
		const json = (await res.json().catch(() => ({}))) as Json;
		if (res.ok) return json;
		if (res.status === 401) {
			throw new ForgeError('NOTION_TOKEN', 'Notion rejected the token (Settings → Secrets)');
		}
		if (res.status === 404) {
			throw new ForgeError(
				'NOTION_NOT_SHARED',
				'Not found. In Notion, share the page with your integration (••• → Connections).',
			);
		}
		throw new ForgeError('NOTION_HTTP', `Notion: ${String(json['message'] ?? res.status)}`);
	}

	async search(query: string): Promise<NotionPageSummary[]> {
		const json = await this.request('POST', '/search', {
			...(query ? { query } : {}),
			filter: { property: 'object', value: 'page' },
			sort: { direction: 'descending', timestamp: 'last_edited_time' },
			page_size: 30,
		});
		return ((json['results'] as Json[] | undefined) ?? []).map(toSummary);
	}

	private async children(id: string, budget: { left: number }, depth: number): Promise<Json[]> {
		const blocks: Json[] = [];
		let cursor: string | undefined;
		do {
			const qs = new URLSearchParams({
				page_size: '100',
				...(cursor ? { start_cursor: cursor } : {}),
			});
			const json = await this.request('GET', `/blocks/${id}/children?${qs}`);
			for (const block of (json['results'] as Json[] | undefined) ?? []) {
				if (budget.left-- <= 0) return blocks;
				if (block['has_children'] && depth < 2 && NESTED.has(String(block['type']))) {
					block['children'] = await this.children(String(block['id']), budget, depth + 1);
				}
				blocks.push(block);
			}
			cursor = json['has_more'] ? String(json['next_cursor']) : undefined;
		} while (cursor && budget.left > 0);
		return blocks;
	}

	async page(id: string): Promise<NotionPage> {
		const page = await this.request('GET', `/pages/${id}`);
		const budget = { left: MAX_BLOCKS };
		const blocks = await this.children(id, budget, 0);
		return {
			...toSummary(page),
			markdown: blocksToMarkdown(blocks),
			truncated: budget.left <= 0,
		};
	}

	async append(
		id: string,
		kind: 'paragraph' | 'to_do' | 'bulleted_list_item',
		text: string,
	): Promise<void> {
		const rich_text = [{ type: 'text', text: { content: text } }];
		const block = kind === 'to_do' ? { rich_text, checked: false } : { rich_text };
		await this.request('PATCH', `/blocks/${id}/children`, {
			children: [{ object: 'block', type: kind, [kind]: block }],
		});
	}

	async create(parentId: string, title: string): Promise<NotionPageSummary> {
		const page = await this.request('POST', '/pages', {
			parent: { page_id: parentId },
			properties: { title: { title: [{ type: 'text', text: { content: title } }] } },
		});
		return toSummary(page);
	}
}
