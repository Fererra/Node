import { getContext } from './context.js';

/**
 * The logging surface modules use. The base logger is created once in
 * `src/app/` and passed to module factories; a Fastify (pino) logger
 * satisfies it.
 */
export interface Logger {
  debug(fields: object, message?: string): void;
  info(fields: object, message?: string): void;
  warn(fields: object, message?: string): void;
  error(fields: object, message?: string): void;
}

/**
 * Fields added to every log line from the request context (FR-8):
 * `requestId` within a request and `userId` once the user is loaded.
 */
export function contextLogFields(): { requestId?: string; userId?: string } {
  const context = getContext();
  if (!context) return {};
  return context.user
    ? { requestId: context.requestId, userId: context.user.id }
    : { requestId: context.requestId };
}
