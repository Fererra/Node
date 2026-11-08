import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import type { Logger } from '../logger.js';

export type Database = NodePgDatabase;

/** Module storage option for PostgreSQL; `src/app/` passes the one `db`. */
export interface PostgresStorage {
  readonly kind: 'postgres';
  readonly db: Database;
}

export interface DatabaseHandle {
  db: Database;
  pool: pg.Pool;
  /** `SELECT now()`: rejects if the database is unavailable (NFR-5). */
  checkConnection(): Promise<Date>;
  close(): Promise<void>;
}

export interface DatabaseOptions {
  url: string;
  log: Logger;
  /** Pool size; the default fits parallel requests in tests. */
  max?: number;
}

/**
 * The pool and the Drizzle instance. Created once by `src/app/` and passed
 * to module factories (ADR-0001, NFR-3). Every query is logged at `debug`
 * with the request's ids from the context, so tests can count queries.
 */
export function createDatabase({
  url,
  log,
  max = 10,
}: DatabaseOptions): DatabaseHandle {
  const pool = new pg.Pool({
    connectionString: url,
    max,
    // Fail fast instead of hanging when the server doesn't answer.
    connectionTimeoutMillis: 5_000,
  });
  // An idle client loses its connection when the server goes away; without
  // a listener the pool's 'error' event would crash the process.
  pool.on('error', (err) => {
    log.warn({ err }, 'idle database connection failed');
  });

  const db = drizzle({
    client: pool,
    logger: {
      logQuery(query) {
        log.debug({ query }, 'db query');
      },
    },
  });

  return {
    db,
    pool,
    async checkConnection() {
      const result = await pool.query<{ now: Date }>('SELECT now() AS now');
      const row = result.rows[0];
      if (!row) throw new Error('SELECT now() returned no rows');
      return row.now;
    },
    close: () => pool.end(),
  };
}
