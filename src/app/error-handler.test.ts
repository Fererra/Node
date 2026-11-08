import { describe, expect, it } from 'vitest';
import {
  AppError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  type ErrorCode,
} from '../shared/errors.js';
import { buildApp } from './app.js';

/** An app with one extra route that throws `error`. */
async function appThrowing(error: unknown) {
  const app = buildApp({ storage: 'memory' });
  app.get('/test/throw', () => {
    throw error;
  });
  app.post(
    '/test/validated',
    {
      schema: {
        body: {
          type: 'object',
          required: ['ids'],
          properties: { ids: { type: 'array', items: { type: 'string' } } },
        },
      },
    },
    () => ({ ok: true }),
  );
  await app.ready();
  return app;
}

describe('global error handler', () => {
  it.each<[ErrorCode, number]>([
    ['VALIDATION_ERROR', 400],
    ['UNAUTHORIZED', 401],
    ['NOT_FOUND', 404],
    ['SEAT_TAKEN', 409],
    ['SHOWTIME_STARTED', 422],
    ['SEAT_NOT_IN_HALL', 422],
    ['IDEMPOTENCY_KEY_REUSED', 422],
    ['SERVICE_UNAVAILABLE', 503],
    ['INTERNAL_ERROR', 500],
  ])('maps AppError %s to %i', async (code, status) => {
    const app = await appThrowing(new AppError(code, `message for ${code}`));
    const res = await app.inject({
      method: 'GET',
      url: '/test/throw',
      headers: { 'x-request-id': 'req-1' },
    });

    expect(res.statusCode).toBe(status);
    expect(res.json()).toEqual({
      error: { code, message: `message for ${code}`, requestId: 'req-1' },
    });
    await app.close();
  });

  it.each([
    ['UnauthorizedError', new UnauthorizedError(), 401],
    ['NotFoundError', new NotFoundError('Movie'), 404],
    ['ServiceUnavailableError', new ServiceUnavailableError('down'), 503],
  ])('maps %s', async (_name, error, status) => {
    const app = await appThrowing(error);
    const res = await app.inject({ method: 'GET', url: '/test/throw' });
    expect(res.statusCode).toBe(status);
    await app.close();
  });

  it('turns any other error into 500 INTERNAL_ERROR with a generic message', async () => {
    const app = await appThrowing(new Error('secret connection string'));
    const res = await app.inject({ method: 'GET', url: '/test/throw' });

    expect(res.statusCode).toBe(500);
    const body = res.json<{ error: Record<string, unknown> }>();
    expect(body.error).toMatchObject({
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    });
    expect(res.body).not.toContain('secret');
    await app.close();
  });

  it('turns schema validation errors into 400 VALIDATION_ERROR', async () => {
    const app = await appThrowing(new Error('unused'));
    const res = await app.inject({
      method: 'POST',
      url: '/test/validated',
      payload: { ids: 'not-an-array' },
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
    await app.close();
  });

  it('turns malformed JSON into 400 VALIDATION_ERROR', async () => {
    const app = await appThrowing(new Error('unused'));
    const res = await app.inject({
      method: 'POST',
      url: '/test/validated',
      headers: { 'content-type': 'application/json' },
      payload: '{"ids": [',
    });

    expect(res.statusCode).toBe(400);
    expect(res.json()).toMatchObject({
      error: { code: 'VALIDATION_ERROR' },
    });
    await app.close();
  });

  it('answers an unknown route with 404 NOT_FOUND in the same body', async () => {
    const app = await appThrowing(new Error('unused'));
    const res = await app.inject({
      method: 'GET',
      url: '/nope',
      headers: { 'x-request-id': 'req-404' },
    });

    expect(res.statusCode).toBe(404);
    expect(res.headers['x-request-id']).toBe('req-404');
    expect(res.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Route GET /nope not found',
        requestId: 'req-404',
      },
    });
    await app.close();
  });
});
