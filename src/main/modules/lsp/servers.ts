import { existsSync } from 'node:fs';
import { delimiter, dirname, join } from 'node:path';

export type LspLanguage = 'python' | 'typescript';

export interface ServerLaunch {
	/** Script run with Electron's own Node (ELECTRON_RUN_AS_NODE), so no system Node is needed. */
	script: string;
	args: string[];
	env: NodeJS.ProcessEnv;
	/** Monaco language ids this server handles. */
	languageIds: string[];
	initializationOptions: Record<string, unknown>;
}

function packageFile(pkg: string, file: string): string {
	return join(dirname(require.resolve(`${pkg}/package.json`)), file);
}

/** The folder's virtual environment, if it has one (`.venv` or `venv`). */
export function findVenv(root: string): { dir: string; bin: string } | null {
	for (const name of ['.venv', 'venv']) {
		const dir = join(root, name);
		const bin = join(dir, process.platform === 'win32' ? 'Scripts' : 'bin');
		if (existsSync(bin)) return { dir, bin };
	}
	return null;
}

/** Prefer the project's own TypeScript (its version and plugins), else the one Forge ships. */
export function tsserverPath(root: string): string {
	const local = join(root, 'node_modules', 'typescript', 'lib', 'tsserver.js');
	return existsSync(local) ? local : packageFile('typescript', 'lib/tsserver.js');
}

export function serverLaunch(
	language: LspLanguage,
	root: string,
	baseEnv = process.env,
): ServerLaunch {
	const env: NodeJS.ProcessEnv = { ...baseEnv, ELECTRON_RUN_AS_NODE: '1' };
	if (language === 'python') {
		// basedpyright finds site-packages by asking `python`; put the project's venv first.
		const venv = findVenv(root);
		if (venv) {
			env['VIRTUAL_ENV'] = venv.dir;
			const pathKey = Object.keys(env).find((k) => k.toLowerCase() === 'path') ?? 'PATH';
			env[pathKey] = `${venv.bin}${delimiter}${env[pathKey] ?? ''}`;
		}
		return {
			script: packageFile('basedpyright', 'langserver.index.js'),
			args: ['--stdio'],
			env,
			languageIds: ['python'],
			initializationOptions: {},
		};
	}
	return {
		script: packageFile('typescript-language-server', 'lib/cli.mjs'),
		args: ['--stdio'],
		env,
		languageIds: ['typescript', 'typescriptreact', 'javascript', 'javascriptreact'],
		initializationOptions: { tsserver: { path: tsserverPath(root) } },
	};
}
