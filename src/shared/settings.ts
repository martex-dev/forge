import { z } from 'zod';

export const GeneralSettingsSchema = z.object({
	fontSize: z.union([z.literal(12), z.literal(13), z.literal(14)]).default(13),
	reduceMotion: z.boolean().default(false),
	/** Check the releases repo and download updates in the background (installed builds only). */
	autoUpdate: z.boolean().default(true),
});
export type GeneralSettings = z.infer<typeof GeneralSettingsSchema>;

/** moduleId → enabled. Missing ids fall back to the manifest's defaultEnabled. */
export const ModuleTogglesSchema = z.record(z.string(), z.boolean());
export type ModuleToggles = z.infer<typeof ModuleTogglesSchema>;

export const DEFAULT_GENERAL: GeneralSettings = GeneralSettingsSchema.parse({});
