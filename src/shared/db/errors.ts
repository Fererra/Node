/**
 * Node socket errors and PostgreSQL SQLSTATEs that mean the database
 * can't be reached or is going away: connection exceptions (class `08`),
 * shutdown (`57P01`…`57P03`), too many connections (`53300`).
 */
const UNAVAILABLE_CODES = new Set([
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'EAI_AGAIN',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENETUNREACH',
  'EPIPE',
  '57P01',
  '57P02',
  '57P03',
  '53300',
]);

/** pg's own errors when a connection is lost or can't be opened in time. */
const UNAVAILABLE_MESSAGE =
  /Connection terminated|timeout exceeded when trying to connect|Client has encountered a connection error|Cannot use a pool after calling end/i;

/**
 * True if `error`, or an error in its `cause` chain (Drizzle wraps driver
 * errors), means the database is unavailable. The global error handler
 * answers such errors with `503 SERVICE_UNAVAILABLE` (FR-9).
 */
export function isDatabaseUnavailableError(error: unknown): boolean {
  let current: unknown = error;
  for (let depth = 0; depth < 5; depth++) {
    if (typeof current !== 'object' || current === null) return false;
    const { code, message, cause, errors } = current as {
      code?: unknown;
      message?: unknown;
      cause?: unknown;
      errors?: unknown;
    };
    if (typeof code === 'string') {
      if (UNAVAILABLE_CODES.has(code) || code.startsWith('08')) return true;
    }
    if (typeof message === 'string' && UNAVAILABLE_MESSAGE.test(message)) {
      return true;
    }
    // Node reports a refused dual-stack connect as an AggregateError.
    if (Array.isArray(errors) && errors.some(isDatabaseUnavailableError)) {
      return true;
    }
    current = cause;
  }
  return false;
}
