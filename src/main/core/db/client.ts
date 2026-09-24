import Database from 'better-sqlite3';
import { type BetterSQLite3Database, drizzle } from 'drizzle-orm/better-sqlite3';

import { migrate } from './migrate';
import * as schema from './schema';

export type Db = BetterSQLite3Database<typeof schema>;

export interface DbHandle {
	db: Db;
	sqlite: Database.Database;
	close: () => void;
}

/** Opens (or creates) the app database and applies pending migrations. Use ':memory:' in tests. */
export function openDatabase(filename: string): DbHandle {
	const sqlite = new Database(filename);
	sqlite.pragma('journal_mode = WAL');
	sqlite.pragma('foreign_keys = ON');
	migrate(sqlite);
	return { db: drizzle(sqlite, { schema }), sqlite, close: () => sqlite.close() };
}
