/** owner/repo from a git remote URL, if it points at github.com. */
export function parseGitHubRemote(url: string): { owner: string; repo: string } | null {
	const trimmed = url.trim();
	// https://github.com/owner/repo(.git)  ·  ssh://git@github.com/owner/repo  ·  git@github.com:owner/repo
	const match =
		/^(?:https?:\/\/(?:[^@/]+@)?|ssh:\/\/git@|git@)github\.com[/:]([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/i.exec(
			trimmed,
		);
	if (!match?.[1] || !match[2]) return null;
	return { owner: match[1], repo: match[2] };
}

/** Prefer `origin`, then `upstream`, then any GitHub remote. */
export function pickRemote(
	remotes: ReadonlyArray<{ name: string; url: string }>,
): { owner: string; repo: string } | null {
	const order = [...remotes].sort(
		(a, b) => rank(a.name) - rank(b.name) || a.name.localeCompare(b.name),
	);
	for (const remote of order) {
		const parsed = parseGitHubRemote(remote.url);
		if (parsed) return parsed;
	}
	return null;
}

function rank(name: string): number {
	return name === 'origin' ? 0 : name === 'upstream' ? 1 : 2;
}
