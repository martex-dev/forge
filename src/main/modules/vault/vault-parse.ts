/**
 * Obsidian-flavoured Markdown parsing, just enough for the index: tags, wikilinks, titles and
 * link resolution. Pure functions, no fs.
 */

const FENCE = /^(```|~~~)/;

/** Text with fenced code blocks and inline code blanked out, so `#include` isn't a tag. */
export function stripCode(text: string): string {
	let inFence = false;
	return text
		.split('\n')
		.map((line) => {
			if (FENCE.test(line.trimStart())) {
				inFence = !inFence;
				return '';
			}
			return inFence ? '' : line.replace(/`[^`\n]*`/g, '');
		})
		.join('\n');
}

export interface Frontmatter {
	tags: string[];
	aliases: string[];
	/** Offset where the note body starts (after the closing ---). */
	bodyStart: number;
}

const listValue = (raw: string): string[] => {
	const v = raw.trim();
	if (!v) return [];
	const inner = v.startsWith('[') && v.endsWith(']') ? v.slice(1, -1) : v;
	return inner
		.split(',')
		.map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
		.filter(Boolean);
};

/** Reads `tags` and `aliases` from YAML frontmatter (inline, list or single value). */
export function parseFrontmatter(text: string): Frontmatter {
	const empty = { tags: [], aliases: [], bodyStart: 0 };
	if (!text.startsWith('---')) return empty;
	const end = text.indexOf('\n---', 3);
	if (end === -1) return empty;
	const lines = text.slice(text.indexOf('\n') + 1, end).split('\n');
	const out: Record<'tags' | 'aliases', string[]> = { tags: [], aliases: [] };
	let current: 'tags' | 'aliases' | null = null;
	for (const line of lines) {
		const key = /^(tags|aliases|tag|alias):(.*)$/i.exec(line);
		if (key) {
			const name = (key[1] ?? '').toLowerCase().startsWith('tag') ? 'tags' : 'aliases';
			current = name;
			out[name].push(...listValue(key[2] ?? ''));
			continue;
		}
		const item = /^\s*-\s+(.+)$/.exec(line);
		if (item && current) out[current].push(...listValue(item[1] ?? ''));
		else if (!/^\s/.test(line)) current = null;
	}
	const afterClose = text.indexOf('\n', end + 1);
	return {
		tags: out.tags.map((t) => t.replace(/^#/, '')),
		aliases: out.aliases,
		bodyStart: afterClose === -1 ? text.length : afterClose + 1,
	};
}

// A tag starts after whitespace or line start and must contain a non-digit (#2024 isn't a tag).
const TAG = /(?:^|\s)#([\p{L}\p{N}_/-]*[\p{L}_/-][\p{L}\p{N}_/-]*)/gu;

/** Frontmatter + inline tags, de-duplicated case-insensitively (first spelling wins). */
export function extractTags(text: string): string[] {
	const fm = parseFrontmatter(text);
	const body = stripCode(text.slice(fm.bodyStart));
	const seen = new Map<string, string>();
	const add = (tag: string): void => {
		const clean = tag.replace(/\/+$/, '');
		if (clean && !seen.has(clean.toLowerCase())) seen.set(clean.toLowerCase(), clean);
	};
	fm.tags.forEach(add);
	for (const match of body.matchAll(TAG)) add(match[1] ?? '');
	return [...seen.values()];
}

const WIKILINK = /!?\[\[([^\]|#^\n]+)(?:[#^][^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g;

/** Targets of [[wikilinks]] and ![[embeds]] (without #heading / |alias), de-duplicated. */
export function extractLinks(text: string): string[] {
	const out = new Set<string>();
	for (const match of stripCode(text).matchAll(WIKILINK)) {
		const target = (match[1] ?? '').trim();
		if (target) out.add(target);
	}
	return [...out];
}

export function noteTitle(rel: string): string {
	const base = rel.slice(rel.lastIndexOf('/') + 1);
	return base.replace(/\.md$/i, '');
}

const folderOf = (rel: string): string => rel.slice(0, Math.max(0, rel.lastIndexOf('/')));

/**
 * Obsidian's resolution: a path-like target matches by path suffix; a bare name matches by file
 * name, preferring the linking note's folder, then the shortest path.
 */
export function resolveLink(target: string, from: string, notes: readonly string[]): string | null {
	const wanted = target.trim().replace(/\\/g, '/').replace(/^\/+/, '').replace(/\.md$/i, '');
	if (!wanted) return null;
	const lower = wanted.toLowerCase();
	const candidates = wanted.includes('/')
		? notes.filter((n) => {
				const bare = n.toLowerCase().replace(/\.md$/, '');
				return bare === lower || bare.endsWith(`/${lower}`);
			})
		: notes.filter((n) => noteTitle(n).toLowerCase() === lower);
	if (candidates.length === 0) return null;
	const here = folderOf(from);
	return (
		candidates.find((n) => folderOf(n) === here) ??
		[...candidates].sort(
			(a, b) => a.split('/').length - b.split('/').length || a.length - b.length,
		)[0] ??
		null
	);
}

const pad = (n: number): string => String(n).padStart(2, '0');
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = [
	'January',
	'February',
	'March',
	'April',
	'May',
	'June',
	'July',
	'August',
	'September',
	'October',
	'November',
	'December',
];

/** The subset of moment.js tokens Obsidian daily-note formats actually use. */
export function formatMomentDate(date: Date, format: string): string {
	const tokens: Record<string, () => string> = {
		YYYY: () => String(date.getFullYear()),
		YY: () => String(date.getFullYear()).slice(-2),
		MMMM: () => MONTHS[date.getMonth()] ?? '',
		MMM: () => (MONTHS[date.getMonth()] ?? '').slice(0, 3),
		MM: () => pad(date.getMonth() + 1),
		M: () => String(date.getMonth() + 1),
		DD: () => pad(date.getDate()),
		D: () => String(date.getDate()),
		dddd: () => DAYS[date.getDay()] ?? '',
		ddd: () => (DAYS[date.getDay()] ?? '').slice(0, 3),
	};
	// Longest tokens first; [escaped] text is kept literally, as in moment.
	return format.replace(/\[([^\]]*)\]|YYYY|YY|MMMM|MMM|MM|M|DD|D|dddd|ddd/g, (m, escaped) =>
		escaped !== undefined ? String(escaped) : (tokens[m]?.() ?? m),
	);
}
