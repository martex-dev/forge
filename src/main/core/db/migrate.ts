import type Database from 'better-sqlite3';

export interface Migration {
	name: string;
	sql: string;
}

// Migrations are bundled into the main build (not read from disk), so packaged builds can't lose them.
const files = import.meta.glob<string>('../../../../drizzle/*.sql', {
	query: '?raw',
	import: 'default',
	eager: true,
});

export const MIGRATIONS: Migration[] = Object.entries(files)
	.map(([path, sql]) => ({ name: path.slice(path.lastIndexOf('/') + 1), sql }))
	.sort((a, b) => a.name.localeCompare(b.name));

/** Applies pending migrations in order, each in its own transaction. Returns names applied. */
export function migrate(sqlite: Database.Database, migrations: Migration[] = MIGRATIONS): string[] {
	sqlite.exec(
		'CREATE TABLE IF NOT EXISTS __forge_migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)',
	);
	const applied = new Set(
		sqlite
			.prepare('SELECT name FROM __forge_migrations')
			.all()
			.map((row) => (row as { name: string }).name),
	);
	const record = sqlite.prepare(
		'INSERT INTO __forge_migrations (name, applied_at) VALUES (?, ?)',
	);
	const ran: string[] = [];

	for (const migration of migrations) {
		if (applied.has(migration.name)) continue;
		const statements = migration.sql
			.split('--> statement-breakpoint')
			.map((s) => s.trim())
			.filter(Boolean);
		sqlite.transaction(() => {
			for (const statement of statements) sqlite.exec(statement);
			record.run(migration.name, Date.now());
		})();
		ran.push(migration.name);
	}
	return ran;
}
