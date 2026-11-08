/** Error codes from docs/api.md#errors. */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'NOT_FOUND'
  | 'SEAT_TAKEN'
  | 'SHOWTIME_STARTED'
  | 'SEAT_NOT_IN_HALL'
  | 'IDEMPOTENCY_KEY_REUSED'
  | 'SERVICE_UNAVAILABLE'
  | 'INTERNAL_ERROR';

/**
 * Base class of expected application errors. The global error handler
 * maps `code` to an HTTP status; anything else becomes `500`.
 */
export class AppError extends Error {
  readonly code: ErrorCode;

  constructor(code: ErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = new.target.name;
    this.code = code;
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('UNAUTHORIZED', 'X-User-Id must be the id of an existing user');
  }
}

export class NotFoundError extends AppError {
  constructor(what: string) {
    super('NOT_FOUND', `${what} not found`);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message: string, options?: ErrorOptions) {
    super('SERVICE_UNAVAILABLE', message, options);
  }
}
