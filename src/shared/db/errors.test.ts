import { describe, expect, it } from 'vitest';
import { isDatabaseUnavailableError } from './errors.js';

const withCode = (code: string, message = `error ${code}`) =>
  Object.assign(new Error(message), { code });

describe('isDatabaseUnavailableError', () => {
  it.each([
    ['a refused connection', withCode('ECONNREFUSED')],
    ['a reset connection', withCode('ECONNRESET')],
    ['admin shutdown (57P01)', withCode('57P01')],
    ['cannot connect now (57P03)', withCode('57P03')],
    ['a connection exception (08006)', withCode('08006')],
    ['a lost connection', new Error('Connection terminated unexpectedly')],
    ['a connect timeout', new Error('timeout exceeded when trying to connect')],
    [
      'a dual-stack refused connect (AggregateError)',
      new AggregateError([withCode('ECONNREFUSED'), withCode('ECONNREFUSED')]),
    ],
    [
      'a wrapped driver error (Drizzle)',
      new Error('Failed query: select 1', { cause: withCode('ECONNREFUSED') }),
    ],
  ])('is true for %s', (_name, error) => {
    expect(isDatabaseUnavailableError(error)).toBe(true);
  });

  it.each([
    ['a unique violation', withCode('23505')],
    ['a deadlock', withCode('40P01')],
    ['a plain error', new Error('boom')],
    ['a string', 'ECONNREFUSED'],
    ['null', null],
  ])('is false for %s', (_name, error) => {
    expect(isDatabaseUnavailableError(error)).toBe(false);
  });
});
