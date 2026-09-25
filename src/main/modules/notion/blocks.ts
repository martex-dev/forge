/**
 * Notion blocks → Markdown for the read view. Only what Notion's API returns as plain structure;
 * rich text keeps bold/italic/code/strike and links. Unsupported blocks become a short marker
 * instead of disappearing, so a page never silently looks shorter than it is.
 */

type Json = Record<string, unknown>;

interface RichText {
	plain_text?: string;
	href?: string | null;
	annotations?: { bold?: boolean; italic?: boolean; strikethrough?: boolean; code?: boolean };
}

export function richText(value: unknown): string {
	if (!Array.isArray(value)) return '';
	return (value as RichText[])
		.map((t) => {
			let s = t.plain_text ?? '';
			if (!s) return '';
			const a = t.annotations ?? {};
			if (a.code) s = `\`${s}\``;
			if (a.bold) s = `**${s}**`;
			if (a.italic) s = `*${s}*`;
			if (a.strikethrough) s = `~~${s}~~`;
			if (t.href && /^https?:\/\//.test(t.href)) s = `[${s}](${t.href})`;
			return s;
		})
		.join('');
}

function fileUrl(value: unknown): string | null {
	const v = (value ?? {}) as {
		type?: string;
		external?: { url?: string };
		file?: { url?: string };
	};
	return v.type === 'external' ? (v.external?.url ?? null) : (v.file?.url ?? null);
}

/** One block to Markdown lines. `depth` indents nested list children. */
export function blockToMarkdown(block: Json, depth = 0, number = 1): string {
	const type = String(block['type'] ?? '');
	const body = (block[type] ?? {}) as Json;
	const text = richText(body['rich_text']);
	const pad = '   '.repeat(depth);
	switch (type) {
		case 'paragraph':
			return `${pad}${text}`;
		case 'heading_1':
			return `# ${text}`;
		case 'heading_2':
			return `## ${text}`;
		case 'heading_3':
			return `### ${text}`;
		case 'bulleted_list_item':
			return `${pad}- ${text}`;
		case 'numbered_list_item':
			return `${pad}${number}. ${text}`;
		case 'to_do':
			return `${pad}- [${body['checked'] ? 'x' : ' '}] ${text}`;
		case 'quote':
			return `> ${text}`;
		case 'callout': {
			const icon = (body['icon'] as { emoji?: string } | undefined)?.emoji ?? '💡';
			return `> ${icon} ${text}`;
		}
		case 'code':
			return `\`\`\`${String(body['language'] ?? '')}\n${richText(body['rich_text'])}\n\`\`\``;
		case 'divider':
			return '---';
		case 'toggle':
			return `${pad}▸ ${text}`;
		case 'child_page':
			return `📄 **${String(body['title'] ?? 'Untitled')}**`;
		case 'child_database':
			return `🗃️ **${String(body['title'] ?? 'Database')}**`;
		case 'bookmark':
		case 'embed':
		case 'link_preview': {
			const url = String(body['url'] ?? '');
			return /^https?:\/\//.test(url) ? `[${url}](${url})` : '';
		}
		case 'image':
		case 'file':
		case 'pdf':
		case 'video': {
			const url = fileUrl(body);
			const caption = richText(body['caption']) || type;
			// Notion-hosted file URLs expire after an hour: a link, not an embedded image.
			return url && /^https:\/\//.test(url) ? `[${caption}](${url})` : `*(${type})*`;
		}
		case 'equation':
			return `\`${String(body['expression'] ?? '')}\``;
		default:
			return `*(${type.replace(/_/g, ' ') || 'block'} not shown)*`;
	}
}

/** A page's top-level blocks (children already attached as `children`) → Markdown. */
export function blocksToMarkdown(blocks: Json[], depth = 0): string {
	const out: string[] = [];
	let number = 0;
	for (const block of blocks) {
		number = block['type'] === 'numbered_list_item' ? number + 1 : 0;
		out.push(blockToMarkdown(block, depth, number));
		const children = block['children'];
		if (Array.isArray(children) && children.length) {
			out.push(blocksToMarkdown(children as Json[], depth + 1));
		}
	}
	// Lists stay tight; everything else gets a blank line so Markdown keeps paragraphs apart.
	return out.reduce((acc, line, i) => {
		if (i === 0) return line;
		const tight = /^\s*(- |\d+\. )/.test(line) && /^\s*(- |\d+\. )/.test(out[i - 1] ?? '');
		return `${acc}${tight ? '\n' : '\n\n'}${line}`;
	}, '');
}

/** The page title, from whichever property is the title (its name varies per database). */
export function pageTitle(page: Json): string {
	const props = (page['properties'] ?? {}) as Record<string, Json>;
	for (const prop of Object.values(props)) {
		if (prop['type'] === 'title') return richText(prop['title']) || 'Untitled';
	}
	return 'Untitled';
}
