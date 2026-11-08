import {
  createDatabase,
  type Database,
  type DatabaseHandle,
} from '../../src/shared/db/database.js';
import type { Logger } from '../../src/shared/logger.js';

const silent: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/**
 * `TEST_DATABASE_URL`, never the development database: tests empty the
 * tables (standards/checks.md).
 */
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error(
      'TEST_DATABASE_URL is not set: copy .env.example to .env or export it',
    );
  }
  if (url === process.env.DATABASE_URL) {
    throw new Error(
      'TEST_DATABASE_URL must differ from DATABASE_URL: tests empty it',
    );
  }
  return url;
}

let handle: DatabaseHandle | undefined;

/** A pool to the test database for setup and fixtures, one per test file. */
export function testDb(): Database {
  handle ??= createDatabase({ url: testDatabaseUrl(), log: silent, max: 2 });
  return handle.db;
}

export async function closeTestDb(): Promise<void> {
  await handle?.close();
  handle = undefined;
}

export function openTestDatabase(): DatabaseHandle {
  return createDatabase({ url: testDatabaseUrl(), log: silent, max: 1 });
}
