import { eq } from 'drizzle-orm';

import type { Db } from './client';
import { layouts } from './schema';

export class LayoutsRepo {
	constructor(private readonly db: Db) {}

	get(room: string): unknown {
		return this.db.select().from(layouts).where(eq(layouts.room, room)).get()?.layout ?? null;
	}

	save(room: string, layout: unknown): void {
		const updatedAt = new Date();
		this.db
			.insert(layouts)
			.values({ room, layout, updatedAt })
			.onConflictDoUpdate({ target: layouts.room, set: { layout, updatedAt } })
			.run();
	}

	reset(room: string): void {
		this.db.delete(layouts).where(eq(layouts.room, room)).run();
	}
}
