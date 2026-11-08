import { fileURLToPath } from 'node:url';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import type { Database } from './database.js';

/** drizzle/ at the repo root, from src/shared/db/ and dist/shared/db/. */
export const MIGRATIONS_FOLDER = fileURLToPath(
  new URL('../../../drizzle', import.meta.url),
);

/** Applies the SQL migrations in drizzle/ that aren't applied yet. */
export function runMigrations(db: Database): Promise<void> {
  return migrate(db, { migrationsFolder: MIGRATIONS_FOLDER });
}
