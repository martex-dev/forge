import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { _electron as electron, type ElectronApplication, expect, test } from '@playwright/test';

test.skip(process.platform !== 'win32', 'process-tree checks use Windows CIM');
test.setTimeout(180_000);

interface Proc {
	pid: number;
	ppid: number;
	name: string;
}

function processes(): Proc[] {
	const out = execFileSync(
		'powershell.exe',
		[
			'-NoProfile',
			'-Command',
			'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name | ConvertTo-Json -Compress',
		],
		{ encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 },
	);
	return (
		JSON.parse(out) as Array<{ ProcessId: number; ParentProcessId: number; Name: string }>
	).map((p) => ({ pid: p.ProcessId, ppid: p.ParentProcessId, name: p.Name.toLowerCase() }));
}

function descendants(all: Proc[], root: number): Proc[] {
	const children = all.filter((p) => p.ppid === root);
	return children.flatMap((c) => [c, ...descendants(all, c.pid)]);
}

/**
 * Finds uv.exe below the launched Electron process (Playwright's pid is a launcher; main is a
 * child) and the real interpreter: the venv python.exe is a shim that spawns another python.exe.
 */
function sidecarTree(launcherPid: number): { uv?: Proc; python?: Proc; all: Proc[] } {
	const all = processes();
	const uv = descendants(all, launcherPid).find((p) => p.name === 'uv.exe');
	if (!uv) return { all: [] };
	const tree = descendants(all, uv.pid);
	const pythons = tree.filter((p) => p.name.startsWith('python'));
	const python = pythons.find((p) => !pythons.some((q) => q.ppid === p.pid));
	return { uv, ...(python ? { python } : {}), all: [uv, ...tree] };
}

test('sidecar goes green, recovers from a killed python.exe, and leaves no orphans on quit', async () => {
	const dir = mkdtempSync(join(tmpdir(), 'forge-sidecar-'));
	let app: ElectronApplication | null = null;
	try {
		app = await electron.launch({
			args: ['.', `--user-data-dir=${dir}`],
			env: { ...process.env, FORGE_E2E: '1' },
		});
		const page = await app.firstWindow();
		const dot = page.locator('[data-sidecar-state]');
		await expect(dot).toHaveAttribute('data-sidecar-state', 'ready', { timeout: 90_000 });

		const mainPid = app.process().pid ?? 0;
		const before = sidecarTree(mainPid);
		expect(before.python, 'python child of uv').toBeDefined();

		execFileSync('taskkill', ['/PID', String(before.python?.pid), '/F']);
		await expect(dot).toHaveAttribute('data-sidecar-state', /restarting|starting/, {
			timeout: 15_000,
		});
		await expect(dot).toHaveAttribute('data-sidecar-state', 'ready', { timeout: 60_000 });

		const after = sidecarTree(mainPid);
		expect(after.python?.pid).toBeDefined();
		expect(after.python?.pid).not.toBe(before.python?.pid);

		await app.close();
		app = null;
		await expect
			.poll(
				() => {
					const alive = new Set(processes().map((p) => p.pid));
					return after.all.map((p) => p.pid).filter((pid) => alive.has(pid));
				},
				{ timeout: 10_000 },
			)
			.toEqual([]);
	} finally {
		await app?.close().catch(() => undefined);
		rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 });
	}
});
