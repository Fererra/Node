import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { isDatabaseUnavailableError } from '../shared/db/errors.js';
import { AppError, type ErrorCode } from '../shared/errors.js';

/** HTTP status of each error code (docs/api.md#errors). */
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  SEAT_TAKEN: 409,
  SHOWTIME_STARTED: 422,
  SEAT_NOT_IN_HALL: 422,
  IDEMPOTENCY_KEY_REUSED: 422,
  SERVICE_UNAVAILABLE: 503,
  INTERNAL_ERROR: 500,
};

const INTERNAL_MESSAGE = 'Internal server error';

export interface ErrorBody {
  error: { code: ErrorCode; message: string; requestId: string };
}

interface DescribedError {
  status: number;
  code: ErrorCode;
  message: string;
}

/**
 * Fastify's own client errors: schema validation, malformed or empty
 * JSON, unsupported content type, body too large. All of them mean the
 * request is malformed, so all become `400 VALIDATION_ERROR`.
 */
function isFastifyClientError(error: unknown): error is Error {
  if (!(error instanceof Error)) return false;
  const { statusCode, code } = error as {
    statusCode?: unknown;
    code?: unknown;
  };
  return (
    typeof statusCode === 'number' &&
    statusCode >= 400 &&
    statusCode < 500 &&
    typeof code === 'string' &&
    code.startsWith('FST_')
  );
}

export function describeError(error: unknown): DescribedError {
  if (error instanceof AppError) {
    return {
      status: STATUS_BY_CODE[error.code],
      code: error.code,
      message: error.message,
    };
  }
  if (isFastifyClientError(error)) {
    return { status: 400, code: 'VALIDATION_ERROR', message: error.message };
  }
  if (isDatabaseUnavailableError(error)) {
    return {
      status: STATUS_BY_CODE.SERVICE_UNAVAILABLE,
      code: 'SERVICE_UNAVAILABLE',
      message: 'The database is unavailable, try again later',
    };
  }
  return { status: 500, code: 'INTERNAL_ERROR', message: INTERNAL_MESSAGE };
}

function sendError(
  request: FastifyRequest,
  reply: FastifyReply,
  { status, code, message }: DescribedError,
): FastifyReply {
  const body: ErrorBody = { error: { code, message, requestId: request.id } };
  return reply.status(status).send(body);
}

/** The one global error handler, and the 404 handler (FR-9, NFR-4). */
export function installErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    const described = describeError(error);
    if (described.status >= 500) {
      request.log.error({ err: error }, 'request failed');
    } else {
      request.log.info(
        { code: described.code, statusCode: described.status },
        described.message,
      );
    }
    return sendError(request, reply, described);
  });

  app.setNotFoundHandler((request, reply) =>
    sendError(request, reply, {
      status: 404,
      code: 'NOT_FOUND',
      message: `Route ${request.method} ${request.url} not found`,
    }),
  );
}
