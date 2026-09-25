import { z } from 'zod';

import { defineChannels } from '../define';

/** Vault-relative, '/'-separated path of a Markdown note. */
export const NotePathSchema = z
	.string()
	.min(4)
	.max(1024)
	.regex(/\.md$/i, 'Not a Markdown note')
	.refine((p) => !p.includes('\\') && !p.startsWith('/'), 'Use a vault-relative path');

export const VaultInfoSchema = z.object({
	/** Absolute folder of the vault, or null when none is chosen. */
	root: z.string().nullable(),
	name: z.string().nullable(),
	noteCount: z.number().int(),
	/** False for a plain Markdown folder without Obsidian's .obsidian settings folder. */
	isObsidian: z.boolean(),
});
export type VaultInfo = z.infer<typeof VaultInfoSchema>;

export const NoteMetaSchema = z.object({
	path: z.string(),
	title: z.string(),
	mtime: z.number(),
	tags: z.array(z.string()),
});
export type NoteMeta = z.infer<typeof NoteMetaSchema>;

export const SearchHitSchema = z.object({
	path: z.string(),
	title: z.string(),
	/** 1-based line of the first match in the body; 0 = title-only match. */
	line: z.number().int(),
	snippet: z.string(),
});
export type SearchHit = z.infer<typeof SearchHitSchema>;

export const vaultChannels = defineChannels({
	'vault:info': { input: z.void(), output: VaultInfoSchema },
	/** Native folder picker; unchanged result if cancelled. */
	'vault:openDialog': { input: z.void(), output: VaultInfoSchema },
	'vault:open': { input: z.string().min(1).max(1024), output: VaultInfoSchema },
	'vault:close': { input: z.void(), output: VaultInfoSchema },
	'vault:notes': { input: z.void(), output: z.array(NoteMetaSchema) },
	'vault:read': {
		input: NotePathSchema,
		output: z.object({ content: z.string(), mtime: z.number() }),
	},
	'vault:write': {
		// baseMtime: what the editor loaded; a different mtime on disk means someone else wrote.
		input: z.object({
			path: NotePathSchema,
			content: z.string().max(10_000_000),
			baseMtime: z.number().nullable(),
		}),
		output: z.object({ mtime: z.number() }),
	},
	'vault:create': {
		input: z.object({ folder: z.string().max(1024), name: z.string().trim().min(1).max(200) }),
		output: z.string(),
	},
	'vault:resolve': {
		input: z.object({ target: z.string().max(1024), from: z.string().max(1024) }),
		output: z.string().nullable(),
	},
	'vault:tags': {
		input: z.void(),
		output: z.array(z.object({ tag: z.string(), count: z.number().int() })),
	},
	'vault:backlinks': { input: NotePathSchema, output: z.array(NoteMetaSchema) },
	'vault:search': { input: z.string().trim().min(1).max(200), output: z.array(SearchHitSchema) },
	/** Appends a timestamped bullet to today's daily note; returns its path. */
	'vault:quickNote': { input: z.string().trim().min(1).max(5000), output: z.string() },
});

export const vaultEvents = {
	/** Notes added/changed/removed (paths), or the whole vault (root switched / rebuilt). */
	'vault:changed': z.object({ paths: z.array(z.string()), full: z.boolean() }),
};
