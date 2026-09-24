import { defineConfig } from 'drizzle-kit';

// Only used by `npm run db:generate` to turn schema changes into SQL migrations in ./drizzle.
export default defineConfig({
	dialect: 'sqlite',
	schema: './src/main/core/db/schema.ts',
	out: './drizzle',
});
