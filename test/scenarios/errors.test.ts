import type { LightMyRequestResponse } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../support/app.js';
import {
  client,
  movies,
  seat,
  showtimes,
  users,
  type BookingBody,
  type ErrorBody,
} from '../support/client.js';

let t: TestApp;
let api: ReturnType<typeof client>;
beforeEach(async () => {
  t = await createTestApp();
  api = client(t.app);
});
afterEach(async () => {
  await t.app.close();
});

const UNKNOWN = '00000000-0000-4000-8000-000000000000';
const valid = {
  showtimeId: showtimes.orbitTomorrow,
  seatIds: [seat(1, 1, 1)],
};

/** Status, code, and the full FR-9 body with the request's id. */
function expectError(
  res: LightMyRequestResponse,
  status: number,
  code: string,
): void {
  expect(res.statusCode).toBe(status);
  const body = res.json<ErrorBody>();
  expect(body).toEqual({
    error: {
      code,
      message: expect.any(String) as unknown,
      requestId: res.headers['x-request-id'],
    },
  });
  expect(body.error.message).not.toBe('');
}

describe('AC-6: 401 UNAUTHORIZED', () => {
  const cases: [string, Record<string, string>][] = [
    ['missing', {}],
    ['not a UUID', { 'x-user-id': 'alice' }],
    ['an unknown user', { 'x-user-id': UNKNOWN }],
  ];

  it.each(cases)('X-User-Id %s on POST /bookings', async (_name, headers) => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/bookings',
      headers: { 'idempotency-key': 'k', ...headers },
      payload: valid,
    });
    expectError(res, 401, 'UNAUTHORIZED');
  });

  it.each(cases)('X-User-Id %s on cancel', async (_name, headers) => {
    const res = await t.app.inject({
      method: 'POST',
      url: `/bookings/${UNKNOWN}/cancel`,
      headers,
    });
    expectError(res, 401, 'UNAUTHORIZED');
  });

  it.each(cases)('X-User-Id %s on GET /me/bookings', async (_name, headers) => {
    const res = await t.app.inject({
      method: 'GET',
      url: '/me/bookings',
      headers,
    });
    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('401 comes before 400: malformed JSON, no key, no user', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/bookings',
      headers: { 'content-type': 'application/json' },
      payload: '{"showtimeId":',
    });
    expectError(res, 401, 'UNAUTHORIZED');
  });

  it('401 comes before 400 on cancel with a bad id', async () => {
    expectError(await api.cancel('not-a-uuid', null), 401, 'UNAUTHORIZED');
  });
});

describe('AC-6: 400 VALIDATION_ERROR on POST /bookings', () => {
  it('malformed JSON', async () => {
    const res = await t.app.inject({
      method: 'POST',
      url: '/bookings',
      headers: {
        'content-type': 'application/json',
        'x-user-id': users.alice,
        'idempotency-key': 'k',
      },
      payload: '{"showtimeId":',
    });
    expectError(res, 400, 'VALIDATION_ERROR');
  });

  it.each<[string, unknown]>([
    ['no body', undefined],
    ['showtimeId is not a UUID', { ...valid, showtimeId: 'x' }],
    ['showtimeId missing', { seatIds: valid.seatIds }],
    ['a seat id is not a UUID', { ...valid, seatIds: ['x'] }],
    ['seatIds is a string', { ...valid, seatIds: seat(1, 1, 1) }],
    ['0 seats', { ...valid, seatIds: [] }],
    [
      '11 seats',
      {
        ...valid,
        seatIds: [1, 2, 3, 4]
          .flatMap((n) => [seat(1, 1, n), seat(1, 2, n), seat(1, 3, n)])
          .slice(0, 11),
      },
    ],
    ['duplicate seats', { ...valid, seatIds: [seat(1, 1, 1), seat(1, 1, 1)] }],
    [
      'duplicate seats in another case',
      { ...valid, seatIds: [seat(1, 1, 1), seat(1, 1, 1).toUpperCase()] },
    ],
  ])('%s', async (_name, body) => {
    expectError(await api.book(body), 400, 'VALIDATION_ERROR');
  });

  it.each<[string, string | null]>([
    ['missing', null],
    ['empty', ''],
    ['longer than 255', 'k'.repeat(256)],
  ])('Idempotency-Key %s', async (_name, key) => {
    expectError(await api.book(valid, { key }), 400, 'VALIDATION_ERROR');
  });

  it('accepts a 255-char Idempotency-Key', async () => {
    const res = await api.book(valid, { key: 'k'.repeat(255) });
    expect(res.statusCode).toBe(201);
  });

  it('400 comes before idempotency: a stored key with a bad body', async () => {
    await api.book(valid, { key: 'k' });
    expectError(
      await api.book({ ...valid, seatIds: [] }, { key: 'k' }),
      400,
      'VALIDATION_ERROR',
    );
  });
});

describe('AC-6: POST /bookings business errors, in the documented order', () => {
  it('idempotency comes before 404: a reused key with an unknown showtime -> 422 IDEMPOTENCY_KEY_REUSED', async () => {
    await api.book(valid, { key: 'k' });
    expectError(
      await api.book({ ...valid, showtimeId: UNKNOWN }, { key: 'k' }),
      422,
      'IDEMPOTENCY_KEY_REUSED',
    );
  });

  it('404 NOT_FOUND for an unknown showtime, even with seats from nowhere', async () => {
    expectError(
      await api.book({ showtimeId: UNKNOWN, seatIds: [UNKNOWN] }),
      404,
      'NOT_FOUND',
    );
  });

  it('422 SHOWTIME_STARTED comes before 422 SEAT_NOT_IN_HALL', async () => {
    // orbitPast is in hall 1; a hall 2 seat is not in its hall.
    expectError(
      await api.book({
        showtimeId: showtimes.orbitPast,
        seatIds: [seat(2, 1, 1)],
      }),
      422,
      'SHOWTIME_STARTED',
    );
  });

  it.each([
    ['a seat of another hall', seat(2, 1, 1)],
    ['a seat that does not exist', UNKNOWN],
  ])('422 SEAT_NOT_IN_HALL for %s', async (_name, other) => {
    expectError(
      await api.book({ ...valid, seatIds: [seat(1, 1, 1), other] }),
      422,
      'SEAT_NOT_IN_HALL',
    );
  });

  it('422 SEAT_NOT_IN_HALL comes before 409 SEAT_TAKEN', async () => {
    await api.book(valid, { key: 'first' });
    expectError(
      await api.book(
        { ...valid, seatIds: [seat(1, 1, 1), seat(2, 1, 1)] },
        { key: 'second' },
      ),
      422,
      'SEAT_NOT_IN_HALL',
    );
  });

  it('409 SEAT_TAKEN for a booked seat', async () => {
    await api.book(valid, { key: 'first' });
    expectError(
      await api.book(valid, { key: 'second', user: users.bob }),
      409,
      'SEAT_TAKEN',
    );
  });
});

describe('AC-6: POST /bookings/:id/cancel errors, in the documented order', () => {
  it('400 VALIDATION_ERROR for an id that is not a UUID', async () => {
    expectError(await api.cancel('not-a-uuid'), 400, 'VALIDATION_ERROR');
  });

  it('404 NOT_FOUND for an unknown booking', async () => {
    expectError(await api.cancel(UNKNOWN), 404, 'NOT_FOUND');
  });

  it("404 NOT_FOUND for someone else's booking, also a cancelled one", async () => {
    const { id } = (await api.book(valid)).json<BookingBody>();
    expectError(await api.cancel(id, users.bob), 404, 'NOT_FOUND');

    await api.cancel(id);
    expectError(await api.cancel(id, users.bob), 404, 'NOT_FOUND');
  });
});

describe('AC-6: errors of the read endpoints', () => {
  it.each([
    ['GET /movies/:id/showtimes', '/movies/not-a-uuid/showtimes'],
    ['GET /showtimes/:id/seats', '/showtimes/not-a-uuid/seats'],
  ])('%s: 400 VALIDATION_ERROR for a bad UUID', async (_name, url) => {
    expectError(
      await t.app.inject({ method: 'GET', url }),
      400,
      'VALIDATION_ERROR',
    );
  });

  it.each([
    ['GET /movies/:id/showtimes', `/movies/${UNKNOWN}/showtimes`],
    ['GET /showtimes/:id/seats', `/showtimes/${UNKNOWN}/seats`],
    ['an unknown route', '/nope'],
    ['a known path with another method', `/movies/${movies.orbitNine}`],
  ])('%s: 404 NOT_FOUND', async (_name, url) => {
    expectError(await t.app.inject({ method: 'GET', url }), 404, 'NOT_FOUND');
  });

  it('DELETE /movies is an unknown route: 404', async () => {
    expectError(
      await t.app.inject({ method: 'DELETE', url: '/movies' }),
      404,
      'NOT_FOUND',
    );
  });
});
