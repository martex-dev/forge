import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { probePackageDir, sidecarCommand } from './launch';

describe('sidecar launch', () => {
	it('runs the bundled binary when packaged', () => {
		const cmd = sidecarCommand(true, join('C:', 'Forge', 'resources'), 'ignored');
		expect(cmd.command).toBe(join('C:', 'Forge', 'resources', 'sidecar', process.platform === 'win32' ? 'forge-sidecar.exe' : 'forge-sidecar'));
		expect(cmd.args).toEqual([]);
	});

	it('uses uv against the source in development', () => {
		const cmd = sidecarCommand(false, 'ignored', join('C:', 'repo'));
		expect(cmd.command).toBe('uv');
		expect(cmd.args).toEqual(['run', '--project', join('C:', 'repo', 'sidecar'), 'python', '-m', 'forge_sidecar']);
		expect(probePackageDir(false, 'x', join('C:', 'repo'))).toBe(join('C:', 'repo', 'packages', 'forge-probe'));
		expect(probePackageDir(true, join('C:', 'r'), 'x')).toBe(join('C:', 'r', 'forge-probe'));
	});
});
