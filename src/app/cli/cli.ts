import type { Logger } from '../../shared/logger.js';
import {
  createDatabase,
  type DatabaseHandle,
} from '../../shared/db/database.js';

/** A plain console logger for the CLIs; queries (debug) are not printed. */
export const cliLog: Logger = {
  debug: () => undefined,
  info: (fields, message) => {
    console.log(message ?? '', fields);
  },
  warn: (fields, message) => {
    console.warn(message ?? '', fields);
  },
  error: (fields, message) => {
    console.error(message ?? '', fields);
  },
};

/**
 * Runs `task` against `DATABASE_URL` and closes the pool; exits non-zero
 * on failure.
 */
export async function runWithDatabase(
  name: string,
  task: (database: DatabaseHandle) => Promise<void>,
): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(`${name}: DATABASE_URL is not set (see .env.example)`);
    process.exit(1);
  }
  const database = createDatabase({ url, log: cliLog, max: 1 });
  try {
    await task(database);
    console.log(`${name}: done`);
  } catch (error) {
    console.error(`${name}: failed`, error);
    process.exitCode = 1;
  } finally {
    await database.close();
  }
}
