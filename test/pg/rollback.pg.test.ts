// AC-9: a failure after the seats insert leaves no booking, seats or key:
// every repository of the unit of work wrote through its transaction.
import { afterEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../support/app.js';
import {
  client,
  errorOf,
  seat,
  showtimes,
  type BookingBody,
} from '../support/client.js';
import { bookingRowCounts } from '../support/fixtures.js';

let t: TestApp | undefined;
afterEach(async () => {
  await t?.app.close();
  t = undefined;
});

const request = {
  showtimeId: showtimes.orbitTomorrow,
  seatIds: [seat(1, 1, 1), seat(1, 1, 2)],
};

describe('AC-9: a failure after the seats insert', () => {
  it('rolls back the key, the booking and its seats; the key can be reused', async () => {
    // The service logs "booking created" right after the repository has
    // inserted the key, the booking and the seats, still inside uow.run.
    // A log stream that throws on that line is a failure at that point.
    let failOnce = true;
    t = await createTestApp({
      logger: {
        stream: {
          write(line: string) {
            const { msg } = JSON.parse(line) as { msg?: string };
            if (failOnce && msg === 'booking created') {
              failOnce = false;
              throw new Error('failure after the seats insert');
            }
          },
        },
      },
    });
    const api = client(t.app);

    const failed = await api.book(request, { key: 'k' });

    expect(failed.statusCode).toBe(500);
    expect(errorOf(failed).code).toBe('INTERNAL_ERROR');
    expect(await bookingRowCounts()).toEqual({
      booking: 0,
      bookingSeat: 0,
      idempotencyKey: 0,
    });
    expect(await api.takenSeats(showtimes.orbitTomorrow)).toEqual([]);

    const retried = await api.book(request, { key: 'k' });
    expect(retried.statusCode).toBe(201);
    expect(retried.json<BookingBody>().seats).toHaveLength(2);
    expect(await bookingRowCounts()).toEqual({
      booking: 1,
      bookingSeat: 2,
      idempotencyKey: 1,
    });
  });
});
