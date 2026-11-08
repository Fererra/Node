import type { NodePgQueryResultHKT } from 'drizzle-orm/node-postgres';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { getContext } from '../context.js';
import type { Database } from './database.js';

/** The pool-backed database or a transaction: both run queries. */
export type Executor = PgDatabase<NodePgQueryResultHKT>;

/**
 * "Transaction or pool" (ADR-0004): the transaction of the current
 * `uow.run` if there is one, else the pool. Repositories call it for
 * every query, so they join a unit of work without knowing about it.
 */
export function executor(db: Database): Executor {
  const transaction = getContext()?.transaction as Executor | undefined;
  return transaction ?? db;
}
