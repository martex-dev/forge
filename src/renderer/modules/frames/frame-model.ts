import type { FrameColumn, FrameQuery } from '@shared/ipc/channels/frames';

export const ROW_HEIGHT = 24;
/** Rows per request; the grid asks for the blocks covering the viewport. */
export const BLOCK = 200;

/** Rows to render for a scroll position, with overscan so fast scrolling doesn't flash. */
export function visibleRange(
	scrollTop: number,
	viewport: number,
	total: number,
	overscan = 10,
): { start: number; end: number } {
	const first = Math.floor(scrollTop / ROW_HEIGHT);
	const count = Math.ceil(viewport / ROW_HEIGHT);
	return {
		start: Math.max(0, first - overscan),
		end: Math.min(total, first + count + overscan),
	};
}

export function blocksFor(range: { start: number; end: number }): number[] {
	if (range.end <= range.start) return [];
	const first = Math.floor(range.start / BLOCK);
	const last = Math.floor((range.end - 1) / BLOCK);
	return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

const NUMERIC = /^(TINYINT|SMALLINT|INTEGER|BIGINT|HUGEINT|U\w*INT|FLOAT|DOUBLE|DECIMAL)/i;

export function isNumericType(type: string): boolean {
	return NUMERIC.test(type);
}

/** Column width in px from its type and name, so numbers stay compact and text gets room. */
export function columnWidth(col: FrameColumn): number {
	// Name and type label share the header.
	const byName = (col.name.length + col.type.length) * 7 + 28;
	const byType = isNumericType(col.type)
		? 96
		: /TIMESTAMP/i.test(col.type)
			? 176
			: /^(DATE|TIME)/i.test(col.type)
				? 104
				: /^BOOL/i.test(col.type)
					? 64
					: 180;
	return Math.min(320, Math.max(byName, byType));
}

export function formatCell(value: unknown): string {
	if (value === null || value === undefined) return '';
	if (typeof value === 'number') {
		if (Number.isInteger(value)) return String(value);
		const abs = Math.abs(value);
		if (abs !== 0 && (abs < 1e-4 || abs >= 1e12)) return value.toExponential(4);
		return String(Number(value.toPrecision(10)));
	}
	if (typeof value === 'string') return value;
	if (typeof value === 'boolean') return value ? 'true' : 'false';
	return JSON.stringify(value);
}

/** Header click cycles ascending → descending → unsorted. Single column; Shift adds a key. */
export function nextSort(
	sort: FrameQuery['sort'],
	column: string,
	additive: boolean,
): FrameQuery['sort'] {
	const current = sort.find((s) => s.column === column);
	const others = additive ? sort.filter((s) => s.column !== column) : [];
	if (!current) return [...others, { column, desc: false }];
	if (!current.desc) {
		return additive
			? sort.map((s) => (s.column === column ? { column, desc: true } : s))
			: [{ column, desc: true }];
	}
	return others;
}

export function basename(path: string): string {
	return path.split(/[\\/]/).pop() ?? path;
}

/** Stable panel instance id per file, so opening a file twice focuses its tab. */
export function instanceIdFor(path: string): string {
	let hash = 2166136261;
	for (const ch of path.toLowerCase()) {
		hash ^= ch.codePointAt(0) ?? 0;
		hash = Math.imul(hash, 16777619) >>> 0;
	}
	return `frames.viewer#${hash.toString(36)}`;
}
