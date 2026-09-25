import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { join } from 'node:path';

import { z } from 'zod';

import type { BackupPreview } from '@shared/ipc/channels/backup';

import type { LayoutsRepo } from '../db/layouts-repo';
import type { SettingsRepo } from '../db/settings-repo';
import { ForgeError } from '../errors';

/** A module's file-based data under userData (e.g. the trade journal's folder). */
export interface BackupProvider {
	folder: string;
	/** Make the files consistent before they're copied (e.g. checkpoint SQLite's WAL). */
	flush?: () => void | Promise<void>;
}

const MANIFEST = 'forge-backup.json';
const STAGING = '.restore-staged';

const ManifestSchema = z.object({
	format: z.literal('forge-backup'),
	version: z.literal(1),
	createdAt: z.number(),
	appVersion: z.string(),
	settings: z.array(z.object({ key: z.string(), value: z.unknown() })),
	layouts: z.array(z.object({ room: z.string(), layout: z.unknown() })),
	folders: z.array(z.string().regex(/^[a-z0-9-]+$/)),
});

const pad = (n: number): string => String(n).padStart(2, '0');
export function backupFolderName(now: Date): string {
	return `forge-backup-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

/**
 * Settings, layouts and module data folders, never secrets: they're encrypted for this Windows
 * account (DPAPI) and have to be re-entered on another machine anyway.
 */
export class BackupService {
	private readonly providers = new Map<string, BackupProvider>();

	constructor(
		private readonly userData: string,
		private readonly settings: SettingsRepo,
		private readonly layouts: LayoutsRepo,
		private readonly appVersion: string,
	) {}

	register(provider: BackupProvider): () => void {
		this.providers.set(provider.folder, provider);
		return () => void this.providers.delete(provider.folder);
	}

	async exportTo(parent: string, now = new Date()): Promise<string> {
		const dir = join(parent, backupFolderName(now));
		mkdirSync(dir, { recursive: true });
		const folders: string[] = [];
		for (const provider of this.providers.values()) {
			const source = join(this.userData, provider.folder);
			if (!existsSync(source)) continue;
			await provider.flush?.();
			// WAL/SHM are transient once flushed; copying a live pair would be inconsistent.
			cpSync(source, join(dir, provider.folder), {
				recursive: true,
				filter: (src) => !/-(wal|shm)$/.test(src),
			});
			folders.push(provider.folder);
		}
		const manifest: z.infer<typeof ManifestSchema> = {
			format: 'forge-backup',
			version: 1,
			createdAt: now.getTime(),
			appVersion: this.appVersion,
			settings: this.settings.all(),
			layouts: this.layouts.all(),
			folders,
		};
		writeFileSync(join(dir, MANIFEST), `${JSON.stringify(manifest, null, 1)}\n`, 'utf8');
		return dir;
	}

	private read(dir: string): z.infer<typeof ManifestSchema> {
		const file = join(dir, MANIFEST);
		if (!existsSync(file)) {
			throw new ForgeError(
				'BACKUP_NOT_FOUND',
				'That folder is not a Forge backup (no forge-backup.json)',
			);
		}
		const parsed = ManifestSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
		if (!parsed.success) {
			throw new ForgeError(
				'BACKUP_INVALID',
				'The backup manifest is damaged or from an unknown version',
			);
		}
		return parsed.data;
	}

	inspect(dir: string): BackupPreview {
		const m = this.read(dir);
		return {
			path: dir,
			createdAt: m.createdAt,
			appVersion: m.appVersion,
			settings: m.settings.length,
			rooms: m.layouts.map((l) => l.room),
			folders: m.folders.filter((f) => existsSync(join(dir, f))),
		};
	}

	/**
	 * Settings and layouts are replaced now; module folders are staged and swapped in at the
	 * next start, before modules open their files (see applyStaged).
	 */
	restore(dir: string): { restartRequired: boolean } {
		const m = this.read(dir);
		this.settings.replaceAll(m.settings);
		this.layouts.replaceAll(m.layouts);
		const staging = join(this.userData, STAGING);
		rmSync(staging, { recursive: true, force: true });
		const staged = m.folders.filter((f) => existsSync(join(dir, f)));
		for (const folder of staged) {
			cpSync(join(dir, folder), join(staging, folder), { recursive: true });
		}
		return { restartRequired: staged.length > 0 };
	}
}

/** Runs at startup before any module: swaps staged folders in, keeping the old ones aside. */
export function applyStaged(userData: string, now = Date.now()): string[] {
	const staging = join(userData, STAGING);
	if (!existsSync(staging)) return [];
	const applied: string[] = [];
	for (const folder of readdirNames(staging)) {
		const live = join(userData, folder);
		if (existsSync(live)) renameSync(live, `${live}.before-restore-${now}`);
		renameSync(join(staging, folder), live);
		applied.push(folder);
	}
	rmSync(staging, { recursive: true, force: true });
	return applied;
}

function readdirNames(dir: string): string[] {
	return readdirSync(dir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);
}
