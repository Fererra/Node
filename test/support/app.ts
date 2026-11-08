import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app/app.js';
import { parseStorage, type Storage } from '../../src/app/config.js';
import type { LoggerOption } from '../../src/app/logger.js';
import type { Clock } from '../../src/shared/clock.js';

/** "Now" of every test app; the seed is built relative to it. */
export const NOW = new Date('2026-06-01T12:00:00.000Z');

/** A clock that stays at `NOW` unless a test moves it. */
export class TestClock implements Clock {
  #time = NOW.getTime();

  now(): Date {
    return new Date(this.#time);
  }

  set(instant: Date): void {
    this.#time = instant.getTime();
  }
}

/**
 * Storage of the run: `npm test` uses memory; the PostgreSQL stage runs
 * the same scenario files with STORAGE=postgres.
 */
export function testStorage(): Storage {
  return parseStorage(process.env.STORAGE ?? 'memory');
}

export interface TestApp {
  app: FastifyInstance;
  clock: TestClock;
}

/** A new app per test, on fresh seed data. */
export async function createTestApp(
  options: { logger?: LoggerOption } = {},
): Promise<TestApp> {
  const clock = new TestClock();
  const app = buildApp({
    storage: testStorage(),
    clock,
    ...(options.logger === undefined ? {} : { logger: options.logger }),
  });
  await app.ready();
  return { app, clock };
}
