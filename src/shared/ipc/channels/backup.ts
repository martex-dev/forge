import { z } from 'zod';

import { defineChannels } from '../define';

export const BackupPreviewSchema = z.object({
	path: z.string(),
	createdAt: z.number(),
	appVersion: z.string(),
	/** Number of stored settings (module toggles, rules, watchlists, …). */
	settings: z.number().int(),
	rooms: z.array(z.string()),
	/** Module data folders in the backup, e.g. "journal". */
	folders: z.array(z.string()),
});
export type BackupPreview = z.infer<typeof BackupPreviewSchema>;

export const backupChannels = defineChannels({
	/** Folder picker, then writes forge-backup-<date>/ inside it; null if cancelled. */
	'backup:export': { input: z.void(), output: z.string().nullable() },
	/** Folder picker for a backup to restore; null if cancelled. */
	'backup:pick': { input: z.void(), output: BackupPreviewSchema.nullable() },
	'backup:restore': {
		input: z.string().min(3).max(1024),
		output: z.object({ restartRequired: z.boolean() }),
	},
	/** Restarts Forge (after a restore that staged module data). */
	'app:relaunch': { input: z.void(), output: z.void() },
});
