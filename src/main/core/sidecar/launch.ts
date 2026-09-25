import { join } from 'node:path';

export interface LaunchCommand {
	command: string;
	args: string[];
	cwd: string;
}

/**
 * Packaged: the PyInstaller build shipped in resources (no Python or uv needed on the machine).
 * Development: `uv run` against the source, so edits apply on restart.
 */
export function sidecarCommand(packaged: boolean, resourcesPath: string, appPath: string): LaunchCommand {
	if (packaged) {
		const dir = join(resourcesPath, 'sidecar');
		const exe = process.platform === 'win32' ? 'forge-sidecar.exe' : 'forge-sidecar';
		return { command: join(dir, exe), args: [], cwd: dir };
	}
	const project = join(appPath, 'sidecar');
	return { command: 'uv', args: ['run', '--project', project, 'python', '-m', 'forge_sidecar'], cwd: project };
}

/** forge-probe ships next to the app when packaged, and lives in the repo in development. */
export function probePackageDir(packaged: boolean, resourcesPath: string, appPath: string): string {
	return packaged ? join(resourcesPath, 'forge-probe') : join(appPath, 'packages', 'forge-probe');
}
