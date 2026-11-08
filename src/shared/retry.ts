import { ServiceUnavailableError } from './errors.js';
import type { Logger } from './logger.js';

/** PostgreSQL `serialization_failure` and `deadlock_detected`. */
const RETRYABLE_CODES = new Set(['40001', '40P01']);

export const DEFAULT_MAX_ATTEMPTS = 3;

/**
 * True for errors worth retrying: a PostgreSQL error (or a wrapper whose
 * `cause` chain contains one) with code `40001` or `40P01`.
 */
export function isRetryableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5 && typeof current === 'object'; depth++) {
    if (current === null) return false;
    const { code, cause } = current as { code?: unknown; cause?: unknown };
    if (typeof code === 'string' && RETRYABLE_CODES.has(code)) return true;
    current = cause;
  }
  return false;
}

export interface RetryOptions {
  log: Logger;
  /** Attempts in total, including the first one. */
  maxAttempts?: number;
  isRetryable?: (error: unknown) => boolean;
}

/**
 * Runs `operation` up to `maxAttempts` times in total while it fails with
 * a retryable error. Every attempt is logged with an `attempt` field.
 * Other errors are rethrown unchanged; when retryable failures exhaust
 * the attempts, a `ServiceUnavailableError` (`503`) is thrown.
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  {
    log,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
    isRetryable = isRetryableError,
  }: RetryOptions,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log.debug({ attempt, maxAttempts }, 'attempt started');
    try {
      return await operation();
    } catch (error) {
      if (!isRetryable(error)) throw error;
      lastError = error;
      log.warn({ attempt, maxAttempts, err: error }, 'attempt failed');
    }
  }
  throw new ServiceUnavailableError('The operation failed, try again later', {
    cause: lastError,
  });
}
