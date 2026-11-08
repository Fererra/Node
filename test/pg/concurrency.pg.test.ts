// AC-4 and AC-5 (parallel): concurrent requests on PostgreSQL. Retries
// are seen in the `attempt` field that withRetry logs.
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../support/app.js';
import {
  client,
  errorOf,
  seat,
  showtimes,
  users,
  type BookingBody,
} from '../support/client.js';
import {
  bookingRowCounts,
  removeSlowSeatInserts,
  slowSeatInserts,
} from '../support/fixtures.js';
import { captureLogs } from '../support/logs.js';

let t: TestApp | undefined;
afterEach(async () => {
  await t?.app.close();
  t = undefined;
  await removeSlowSeatInserts();
});

async function appWithLogs() {
  const logs = captureLogs();
  t = await createTestApp({ logger: logs.logger });
  return { api: client(t.app), logs };
}

const a = seat(1, 1, 1);
const b = seat(1, 1, 2);
const request = (seatIds: string[]) => ({
  showtimeId: showtimes.orbitTomorrow,
  seatIds,
});

describe('AC-4: parallel bookings of the same seats', () => {
  it('one seat, 5 users at once -> one 201, the rest 409, one booking', async () => {
    const { api } = await appWithLogs();

    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        api.book(request([a]), {
          user: i % 2 === 0 ? users.alice : users.bob,
          key: `parallel-${String(i)}`,
        }),
      ),
    );

    const statuses = results.map((r) => r.statusCode).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    for (const res of results.filter((r) => r.statusCode === 409)) {
      expect(errorOf(res).code).toBe('SEAT_TAKEN');
    }
    expect(await api.takenSeats(showtimes.orbitTomorrow)).toEqual([a]);
    expect(await bookingRowCounts()).toEqual({
      booking: 1,
      bookingSeat: 1,
      idempotencyKey: 1,
    });
  });

  it('[a,b] vs [b,a] at the same time -> 201 + 409 with no retry (seats are inserted in one order)', async () => {
    // Each seat row insert waits 0.3 s, so both requests are inside their
    // seat inserts together. In opposite orders they would deadlock
    // (40P01) and one of them would be retried.
    await slowSeatInserts(0.3);
    const { api, logs } = await appWithLogs();

    const [ab, ba] = await Promise.all([
      api.book(request([a, b]), {
        user: users.alice,
        key: 'ab',
        headers: { 'x-request-id': 'req-ab' },
      }),
      api.book(request([b, a]), {
        user: users.bob,
        key: 'ba',
        headers: { 'x-request-id': 'req-ba' },
      }),
    ]);

    expect([ab.statusCode, ba.statusCode].sort()).toEqual([201, 409]);
    const failed = ab.statusCode === 409 ? ab : ba;
    expect(errorOf(failed).code).toBe('SEAT_TAKEN');
    // Exactly one attempt each: no deadlock, no retry.
    expect(logs.attempts('req-ab')).toEqual([1]);
    expect(logs.attempts('req-ba')).toEqual([1]);
    expect(logs.messages('attempt failed')).toEqual([]);
    expect((await api.takenSeats(showtimes.orbitTomorrow)).sort()).toEqual(
      [a, b].sort(),
    );
  });
});

describe('AC-5: two parallel requests with one key', () => {
  it('both 201 with the same body; the second waits for the first and replays it', async () => {
    // The first request holds its claim on the key while it inserts seats.
    await slowSeatInserts(0.3);
    const { api, logs } = await appWithLogs();

    const [first, second] = await Promise.all([
      api.book(request([a, b]), { key: 'same' }),
      api.book(request([b, a]), { key: 'same' }),
    ]);

    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    expect(second.json<BookingBody>()).toEqual(first.json<BookingBody>());
    expect(logs.messages('booking created')).toHaveLength(1);
    expect(logs.messages('booking replayed')).toHaveLength(1);
    expect(logs.messages('attempt failed')).toEqual([]);
    expect(await bookingRowCounts()).toEqual({
      booking: 1,
      bookingSeat: 2,
      idempotencyKey: 1,
    });
  });
});
