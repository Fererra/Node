/**
 * Shared port: marks an atomic step (ADR-0004). The database
 * implementation runs `work` in a transaction with retries; `work` must
 * have no external side effects, because it may run more than once.
 */
export interface UnitOfWork {
  run<T>(work: () => Promise<T>): Promise<T>;
}

/**
 * In-memory stage: no transaction and no retries, `work` just runs.
 * Repositories make their final write in one synchronous step instead
 * (docs/api.md#idempotency).
 */
export const inMemoryUnitOfWork: UnitOfWork = {
  run: (work) => work(),
};
