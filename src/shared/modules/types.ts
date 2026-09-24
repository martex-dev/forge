import { z } from 'zod';

import { type RoomId, RoomIdSchema } from '../rooms';

/** A secret a module needs. The value only ever lives in main (SecretsService). */
/** Subset of NodeJS.Platform; declared here because shared code can't use Node types. */
export type Platform = 'win32' | 'darwin' | 'linux';

export interface SecretSpec {
	/** Stable storage key, e.g. `github.token`. */
	key: string;
	label: string;
	/** Where to get it, shown in Settings → Secrets. */
	help?: string;
}

export interface ModuleManifest {
	id: string;
	name: string;
	description: string;
	room: RoomId | 'global';
	/** Omit for all platforms, e.g. ['win32'] for MT5. */
	platforms?: Platform[];
	requiredSecrets?: SecretSpec[];
	settings?: z.ZodType;
	defaultEnabled: boolean;
}

export function defineManifest(manifest: ModuleManifest): ModuleManifest {
	return manifest;
}

export function isSupportedOn(manifest: ModuleManifest, platform: string): boolean {
	return !manifest.platforms || manifest.platforms.includes(platform as Platform);
}

/** Resolves enabled state: explicit toggle wins, otherwise the manifest default; unsupported is never enabled. */
export function isModuleEnabled(
	manifest: ModuleManifest,
	toggles: Record<string, boolean>,
	platform: string,
): boolean {
	if (!isSupportedOn(manifest, platform)) return false;
	return toggles[manifest.id] ?? manifest.defaultEnabled;
}

export const ModuleInfoSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
	room: z.union([RoomIdSchema, z.literal('global')]),
	platforms: z.array(z.string()).nullable(),
	supported: z.boolean(),
	enabled: z.boolean(),
	defaultEnabled: z.boolean(),
	requiredSecrets: z.array(
		z.object({ key: z.string(), label: z.string(), help: z.string().optional() }),
	),
});
export type ModuleInfo = z.infer<typeof ModuleInfoSchema>;

export function toModuleInfo(
	manifest: ModuleManifest,
	toggles: Record<string, boolean>,
	platform: string,
): ModuleInfo {
	return {
		id: manifest.id,
		name: manifest.name,
		description: manifest.description,
		room: manifest.room,
		platforms: manifest.platforms ?? null,
		supported: isSupportedOn(manifest, platform),
		enabled: isModuleEnabled(manifest, toggles, platform),
		defaultEnabled: manifest.defaultEnabled,
		requiredSecrets: (manifest.requiredSecrets ?? []).map((s) => ({
			key: s.key,
			label: s.label,
			...(s.help ? { help: s.help } : {}),
		})),
	};
}
