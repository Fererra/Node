import { randomUUID } from 'node:crypto';
import { getContext, runWithContext } from '../context.js';
import type { Logger } from '../logger.js';
import { withRetry } from '../retry.js';
import type { UnitOfWork } from '../unit-of-work.js';
import type { Database } from './database.js';

/**
 * Database `UnitOfWork` (ADR-0004): `work` runs in a `READ COMMITTED`
 * transaction stored in the request context, with up to 3 attempts on
 * `40001` / `40P01` (then `503`). An error thrown by `work` rolls back and
 * is rethrown unchanged. A nested `run` reuses the outer transaction.
 */
export function createDbUnitOfWork(db: Database, log: Logger): UnitOfWork {
  return {
    run(work) {
      const context = getContext();
      if (context?.transaction !== undefined) return work();

      return withRetry(
        () =>
          db.transaction(
            (transaction) =>
              runWithContext(
                {
                  ...(context ?? { requestId: randomUUID() }),
                  transaction,
                },
                work,
              ),
            { isolationLevel: 'read committed' },
          ),
        { log },
      );
    },
  };
}
