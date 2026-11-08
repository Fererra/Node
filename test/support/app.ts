import type { FastifyInstance } from 'fastify';
import { buildApp } from '../../src/app/app.js';
import { parseStorage, type Storage } from '../../src/app/config.js';
import type { LoggerOption } from '../../src/app/logger.js';
import type { Clock } from '../../src/shared/clock.js';
import { testDatabaseUrl } from './db.js';

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

/**
 * A new app per test, on fresh seed data: in memory the app builds it;
 * with postgres, test/support/pg-setup.ts reseeds the test database
 * before each test.
 */
export async function createTestApp(
  options: { logger?: LoggerOption } = {},
): Promise<TestApp> {
  const clock = new TestClock();
  const storage = testStorage();
  const app = buildApp({
    storage,
    clock,
    ...(storage === 'postgres' ? { databaseUrl: testDatabaseUrl() } : {}),
    ...(options.logger === undefined ? {} : { logger: options.logger }),
  });
  await app.ready();
  return { app, clock };
}
