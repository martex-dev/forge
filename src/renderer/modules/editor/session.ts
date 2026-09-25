/** Per-folder list of open tabs, so reopening a project restores where you were. */
interface Session {
	files: string[];
	active: string | null;
}

const key = (root: string): string => `forge.editor.session:${root.toLowerCase()}`;

export function loadSession(root: string): Session {
	try {
		const raw = localStorage.getItem(key(root));
		if (!raw) return { files: [], active: null };
		const parsed = JSON.parse(raw) as Partial<Session>;
		const files = Array.isArray(parsed.files)
			? parsed.files.filter((f): f is string => typeof f === 'string').slice(0, 30)
			: [];
		const active = typeof parsed.active === 'string' ? parsed.active : null;
		return { files, active };
	} catch {
		// Corrupt or unavailable storage: start with no tabs.
		return { files: [], active: null };
	}
}

export function saveSession(root: string, session: Session): void {
	try {
		localStorage.setItem(key(root), JSON.stringify(session));
	} catch {
		// Non-critical convenience; ignore quota/availability errors.
	}
}
