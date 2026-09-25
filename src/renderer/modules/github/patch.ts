export interface PatchLine {
	kind: 'hunk' | 'add' | 'del' | 'ctx' | 'meta';
	text: string;
	oldLine: number | null;
	newLine: number | null;
}

const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

/** GitHub's per-file `patch` (hunks only, no file headers) → numbered lines for display. */
export function parsePatch(patch: string): PatchLine[] {
	const out: PatchLine[] = [];
	let oldLine = 0;
	let newLine = 0;
	for (const raw of patch.split('\n')) {
		const hunk = HUNK.exec(raw);
		if (hunk) {
			oldLine = Number(hunk[1]);
			newLine = Number(hunk[2]);
			out.push({ kind: 'hunk', text: raw, oldLine: null, newLine: null });
		} else if (raw.startsWith('\\')) {
			// "\ No newline at end of file"
			out.push({ kind: 'meta', text: raw, oldLine: null, newLine: null });
		} else if (raw.startsWith('+')) {
			out.push({ kind: 'add', text: raw.slice(1), oldLine: null, newLine: newLine++ });
		} else if (raw.startsWith('-')) {
			out.push({ kind: 'del', text: raw.slice(1), oldLine: oldLine++, newLine: null });
		} else {
			out.push({ kind: 'ctx', text: raw.slice(1), oldLine: oldLine++, newLine: newLine++ });
		}
	}
	// A trailing newline in the patch text yields one empty context line; drop it.
	const last = out.at(-1);
	if (last?.kind === 'ctx' && last.text === '' && patch.endsWith('\n')) out.pop();
	return out;
}
