import type { FastifyServerOptions } from 'fastify';
import { contextLogFields } from '../shared/logger.js';

export type LoggerOption =
  | boolean
  | {
      level?: string;
      /** Where JSON lines go (tests capture them); stdout by default. */
      stream?: { write(line: string): void };
    };

/**
 * pino options for Fastify: every line gets `requestId` and `userId`
 * from the request context (FR-8), whichever layer writes it.
 */
export function loggerOptions(
  option: LoggerOption,
): FastifyServerOptions['logger'] {
  if (option === false) return false;
  const { level = 'info', stream } = option === true ? {} : option;
  return {
    level,
    ...(stream ? { stream } : {}),
    mixin: () => contextLogFields(),
  };
}
