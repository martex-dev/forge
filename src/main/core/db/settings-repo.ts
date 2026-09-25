import { eq } from 'drizzle-orm';
import type { z } from 'zod';

import type { Db } from './client';
import { settings } from './schema';

/**
 * Typed key/value access. Every read is validated; a corrupt or outdated value falls back to
 * `fallback` instead of crashing the app, and the caller's logger is told why.
 */
export class SettingsRepo {
	constructor(
		private readonly db: Db,
		private readonly onInvalid: (key: string, issues: string) => void = () => undefined,
	) {}

	get<S extends z.ZodType>(key: string, schema: S, fallback: z.output<S>): z.output<S> {
		const row = this.db.select().from(settings).where(eq(settings.key, key)).get();
		if (!row) return fallback;
		const parsed = schema.safeParse(row.value);
		if (!parsed.success) {
			this.onInvalid(key, parsed.error.message);
			return fallback;
		}
		return parsed.data;
	}

	set<S extends z.ZodType>(key: string, schema: S, value: z.input<S>): z.output<S> {
		const parsed = schema.parse(value);
		// "No value" is stored as a missing row, so reads fall back to their default.
		if (parsed === null || parsed === undefined) {
			this.delete(key);
			return parsed;
		}
		this.db
			.insert(settings)
			.values({ key, value: parsed })
			.onConflictDoUpdate({ target: settings.key, set: { value: parsed } })
			.run();
		return parsed;
	}

	delete(key: string): void {
		this.db.delete(settings).where(eq(settings.key, key)).run();
	}
}
