import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { GitHubService, repoOfFolder, toForgeError } from './github-service';

describe('toForgeError', () => {
	it('explains bad tokens, rate limits and missing access', () => {
		expect(toForgeError({ status: 401 })).toMatchObject({ code: 'GITHUB_BAD_TOKEN' });
		const reset = String(Math.round((Date.now() + 10 * 60_000) / 1000));
		const limited = toForgeError({
			status: 403,
			response: { headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': reset } },
		});
		expect(limited).toMatchObject({ code: 'GITHUB_RATE_LIMIT' });
		expect(limited.message).toMatch(/~10 min/);
		expect(toForgeError({ status: 404 })).toMatchObject({ code: 'GITHUB_NO_ACCESS' });
		expect(toForgeError(new Error('ECONNRESET'))).toMatchObject({ code: 'GITHUB_UNAVAILABLE' });
	});
});

describe('GitHubService without a token', () => {
	it('asks for a token instead of calling GitHub', async () => {
		const service = new GitHubService(() => null);
		expect(service.hasToken()).toBe(false);
		await expect(service.runs({ owner: 'o', repo: 'r' })).rejects.toMatchObject({
			code: 'GITHUB_NO_TOKEN',
		});
	});
});

describe('repoOfFolder (real git)', () => {
	it('reads the GitHub remote, preferring origin', async () => {
		const root = mkdtempSync(join(tmpdir(), 'forge-gh-'));
		try {
			const git = (...args: string[]): void => {
				execFileSync('git', ['-C', root, ...args], { windowsHide: true });
			};
			git('init', '-q');
			expect(await repoOfFolder(root)).toBeNull();
			git('remote', 'add', 'upstream', 'https://github.com/org/forge.git');
			git('remote', 'add', 'origin', 'git@github.com:martex-dev/forge.git');
			expect(await repoOfFolder(root)).toEqual({ owner: 'martex-dev', repo: 'forge' });
		} finally {
			rmSync(root, { recursive: true, force: true, maxRetries: 5 });
		}
	});

	it('returns null outside a repository', async () => {
		const root = mkdtempSync(join(tmpdir(), 'forge-gh-'));
		try {
			expect(await repoOfFolder(root)).toBeNull();
		} finally {
			rmSync(root, { recursive: true, force: true });
		}
	});
});
