// AC-12 (NFR-7): no N+1. Each endpoint runs the same number of queries
// for 1 and for 20 items (FR-4: 1 and 10 seats). Queries are counted
// from the `db query` lines that shared/db logs with the request's id.
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../support/app.js';
import { users, type BookingBody } from '../support/client.js';
import {
  moviesWithGenres,
  showtimeWithSeats,
  userWithBookings,
} from '../support/fixtures.js';
import { captureLogs } from '../support/logs.js';

let t: TestApp | undefined;
afterEach(async () => {
  await t?.app.close();
  t = undefined;
});

let requests = 0;

/** Runs one request and returns the SQL statements it ran. */
async function queriesOf(
  send: (
    app: TestApp['app'],
    requestId: string,
  ) => Promise<{
    statusCode: number;
    body: string;
  }>,
  expectedStatus = 200,
): Promise<{ queries: string[]; body: string }> {
  const logs = captureLogs();
  t = await createTestApp({ logger: logs.logger });
  const requestId = `count-${String(++requests)}`;
  const res = await send(t.app, requestId);
  expect(res.statusCode, res.body).toBe(expectedStatus);
  await t.app.close();
  t = undefined;
  return { queries: logs.queries(requestId), body: res.body };
}

const get = (url: string, user?: string) => (app: TestApp['app'], id: string) =>
  app.inject({
    method: 'GET',
    url,
    headers: { 'x-request-id': id, ...(user ? { 'x-user-id': user } : {}) },
  });

describe('AC-12: the same query count for 1 and for many items', () => {
  it('FR-1 GET /movies: 1 vs 20 movies', async () => {
    await moviesWithGenres(1);
    const one = await queriesOf(get('/movies'));
    await moviesWithGenres(20);
    const many = await queriesOf(get('/movies'));

    expect(JSON.parse(one.body)).toHaveLength(1);
    expect(JSON.parse(many.body)).toHaveLength(20);
    expect(many.queries).toHaveLength(one.queries.length);
    // movies with aggregated genres
    expect(one.queries).toHaveLength(1);
  });

  it('FR-3 GET /showtimes/:id/seats: 1 vs 20 seats, half of them taken', async () => {
    const small = await showtimeWithSeats(1, { taken: 1 });
    const one = await queriesOf(get(`/showtimes/${small.showtimeId}/seats`));
    const large = await showtimeWithSeats(20, { taken: 10 });
    const many = await queriesOf(get(`/showtimes/${large.showtimeId}/seats`));

    expect(JSON.parse(one.body)).toHaveLength(1);
    expect(JSON.parse(many.body)).toHaveLength(20);
    expect(many.queries).toHaveLength(one.queries.length);
    // showtime, its movie and hall (port), taken seats, hall seats (port)
    expect(one.queries).toHaveLength(5);
  });

  it('FR-6 GET /me/bookings: 1 vs 20 bookings (20 showtimes, movies, halls)', async () => {
    await userWithBookings(1);
    const one = await queriesOf(get('/me/bookings', users.alice));
    await userWithBookings(20);
    const many = await queriesOf(get('/me/bookings', users.alice));

    expect(JSON.parse(one.body)).toHaveLength(1);
    expect(JSON.parse(many.body)).toHaveLength(20);
    expect(many.queries).toHaveLength(one.queries.length);
    // user, bookings with seat ids, then one batch per port: showtimes
    // (+ movies, halls) and seats
    expect(one.queries).toHaveLength(6);
  });

  it('FR-4 POST /bookings: 1 vs 10 seats', async () => {
    const book =
      (showtimeId: string, seatIds: string[]) =>
      (app: TestApp['app'], id: string) =>
        app.inject({
          method: 'POST',
          url: '/bookings',
          headers: {
            'x-request-id': id,
            'x-user-id': users.alice,
            'idempotency-key': id,
          },
          payload: { showtimeId, seatIds },
        });

    const small = await showtimeWithSeats(1);
    const one = await queriesOf(book(small.showtimeId, small.seatIds), 201);
    const large = await showtimeWithSeats(10);
    const many = await queriesOf(book(large.showtimeId, large.seatIds), 201);

    expect((JSON.parse(one.body) as BookingBody).seats).toHaveLength(1);
    expect((JSON.parse(many.body) as BookingBody).seats).toHaveLength(10);
    expect(many.queries).toHaveLength(one.queries.length);
    // user, BEGIN, claim key, showtime (+ movie, hall), seats, booking,
    // booking seats, COMMIT
    expect(one.queries).toHaveLength(10);
  });
});
