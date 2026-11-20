import { describe, expect, it, vi } from 'vitest';
import { ServiceUnavailableError } from '../../src/shared/errors.js';
import type { Logger } from '../../src/shared/logger.js';
import { isRetryableError, withRetry } from '../../src/shared/retry.js';

function pgError(code: string): Error & { code: string } {
  return Object.assign(new Error(`pg error ${code}`), { code });
}

function recordingLogger() {
  const lines: { level: string; fields: Record<string, unknown> }[] = [];
  const at =
    (level: string) =>
    (fields: object): void => {
      lines.push({ level, fields: fields as Record<string, unknown> });
    };
  const log: Logger = {
    debug: at('debug'),
    info: at('info'),
    warn: at('warn'),
    error: at('error'),
  };
  const attempts = () =>
    lines.filter((l) => l.level === 'debug').map((l) => l.fields.attempt);
  return { log, lines, attempts };
}

describe('withRetry', () => {
  it.each(['40001', '40P01'])(
    'retries %s and returns the first success',
    async (code) => {
      const { log, attempts } = recordingLogger();
      const operation = vi
        .fn<() => Promise<string>>()
        .mockRejectedValueOnce(pgError(code))
        .mockRejectedValueOnce(pgError(code))
        .mockResolvedValue('done');

      await expect(withRetry(operation, { log })).resolves.toBe('done');
      expect(operation).toHaveBeenCalledTimes(3);
      expect(attempts()).toEqual([1, 2, 3]);
    },
  );

  it('makes 3 attempts in total, then throws a 503 error with the cause', async () => {
    const { log, attempts } = recordingLogger();
    const last = pgError('40P01');
    const operation = vi
      .fn<() => Promise<never>>()
      .mockRejectedValueOnce(pgError('40001'))
      .mockRejectedValueOnce(pgError('40P01'))
      .mockRejectedValueOnce(last);

    const error: unknown = await withRetry(operation, { log }).catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(ServiceUnavailableError);
    expect(error).toMatchObject({ code: 'SERVICE_UNAVAILABLE', cause: last });
    expect(operation).toHaveBeenCalledTimes(3);
    expect(attempts()).toEqual([1, 2, 3]);
  });

  it('does not retry 23505 (unique violation) and rethrows it unchanged', async () => {
    const { log, attempts } = recordingLogger();
    const unique = pgError('23505');
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(unique);

    await expect(withRetry(operation, { log })).rejects.toBe(unique);
    expect(operation).toHaveBeenCalledTimes(1);
    expect(attempts()).toEqual([1]);
  });

  it('rethrows non-database errors unchanged after one attempt', async () => {
    const { log } = recordingLogger();
    const error = new Error('seat taken');
    const operation = vi.fn<() => Promise<never>>().mockRejectedValue(error);

    await expect(withRetry(operation, { log })).rejects.toBe(error);
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it('logs a warning with the attempt number for each retryable failure', async () => {
    const { log, lines } = recordingLogger();
    const operation = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(pgError('40P01'))
      .mockResolvedValue('ok');

    await withRetry(operation, { log });

    expect(
      lines.filter((l) => l.level === 'warn').map((l) => l.fields.attempt),
    ).toEqual([1]);
  });

  it('respects a custom maxAttempts', async () => {
    const { log } = recordingLogger();
    const operation = vi
      .fn<() => Promise<never>>()
      .mockRejectedValue(pgError('40001'));

    await expect(withRetry(operation, { log, maxAttempts: 1 })).rejects.toThrow(
      ServiceUnavailableError,
    );
    expect(operation).toHaveBeenCalledTimes(1);
  });
});

describe('isRetryableError', () => {
  it('finds the code in a cause chain (ORM error wrappers)', () => {
    const wrapped = new Error('query failed', { cause: pgError('40P01') });
    expect(isRetryableError(wrapped)).toBe(true);
  });

  /** `error` wrapped in `levels` errors, so it sits at depth `levels`. */
  function atDepth(error: unknown, levels: number): unknown {
    let current = error;
    for (let i = 0; i < levels; i++) {
      current = new Error(`wrapper ${String(i)}`, { cause: current });
    }
    return current;
  }

  it('finds the code at depth 4, the last level it looks at', () => {
    expect(isRetryableError(atDepth(pgError('40P01'), 4))).toBe(true);
  });

  it('ignores the code at depth 5', () => {
    expect(isRetryableError(atDepth(pgError('40P01'), 5))).toBe(false);
  });

  it('returns false for a cyclic cause chain without a code', () => {
    const cyclic = new Error('cyclic') as Error & { cause: unknown };
    cyclic.cause = cyclic;
    expect(isRetryableError(cyclic)).toBe(false);
  });

  it.each([
    ['23505', pgError('23505')],
    ['no code', new Error('x')],
    ['a string', 'boom'],
    ['null', null],
  ])('is false for %s', (_name, error) => {
    expect(isRetryableError(error)).toBe(false);
  });
});
