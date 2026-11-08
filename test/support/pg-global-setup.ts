// test:func, once per run: the test database is rebuilt from the
// migrations, so the run also checks that they apply to an empty database.
import { sql } from 'drizzle-orm';
import { runMigrations } from '../../src/shared/db/migrate.js';
import { openTestDatabase } from './db.js';

export default async function setup(): Promise<void> {
  const database = openTestDatabase();
  try {
    await database.db.execute(sql`drop schema if exists drizzle cascade`);
    await database.db.execute(sql`drop schema if exists public cascade`);
    await database.db.execute(sql`create schema public`);
    await runMigrations(database.db);
  } finally {
    await database.close();
  }
}
