import { describe, expect, it } from 'vitest';

import { parseGitHubRemote, pickRemote } from './remote';

describe('parseGitHubRemote', () => {
	it.each([
		['https://github.com/martex-dev/forge.git', 'martex-dev', 'forge'],
		['https://github.com/martex-dev/forge', 'martex-dev', 'forge'],
		['https://token@github.com/a/b.c.git', 'a', 'b.c'],
		['git@github.com:martex-dev/forge.git', 'martex-dev', 'forge'],
		['ssh://git@github.com/martex-dev/forge', 'martex-dev', 'forge'],
	])('%s', (url, owner, repo) => {
		expect(parseGitHubRemote(url)).toEqual({ owner, repo });
	});

	it('rejects other hosts and malformed URLs', () => {
		expect(parseGitHubRemote('https://gitlab.com/a/b.git')).toBeNull();
		expect(parseGitHubRemote('https://github.com.evil.io/a/b')).toBeNull();
		expect(parseGitHubRemote('https://github.com/only-owner')).toBeNull();
	});
});

describe('pickRemote', () => {
	it('prefers origin, then upstream', () => {
		expect(
			pickRemote([
				{ name: 'fork', url: 'git@github.com:me/x.git' },
				{ name: 'upstream', url: 'git@github.com:org/x.git' },
				{ name: 'origin', url: 'https://gitlab.com/me/x.git' },
			]),
		).toEqual({ owner: 'org', repo: 'x' });
	});
});
