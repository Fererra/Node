import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, NOW, type TestApp } from '../support/app.js';
import {
  client,
  errorOf,
  seat,
  showtimes,
  users,
  type BookingBody,
  type MyBookingBody,
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

const minutes = (n: number) => new Date(NOW.getTime() + n * 60_000);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('FR-4: POST /bookings', () => {
  it('creates a RESERVED booking with its seats by row and number: 201', async () => {
    const res = await api.book({
      showtimeId: showtimes.orbitTomorrow,
      seatIds: [seat(1, 2, 1), seat(1, 1, 3)],
    });

    expect(res.statusCode).toBe(201);
    const booking = res.json<BookingBody>();
    expect(booking).toEqual({
      id: expect.stringMatching(UUID) as unknown,
      showtimeId: showtimes.orbitTomorrow,
      status: 'RESERVED',
      seats: [
        { id: seat(1, 1, 3), row: 1, number: 3 },
        { id: seat(1, 2, 1), row: 2, number: 1 },
      ],
      createdAt: NOW.toISOString(),
    });
  });

  it('accepts 10 seats', async () => {
    const seatIds = [1, 2, 3, 4].flatMap((n) => [seat(1, 1, n), seat(1, 2, n)]);
    seatIds.push(seat(1, 3, 1), seat(1, 3, 2));
    const res = await api.book({
      showtimeId: showtimes.orbitTomorrow,
      seatIds,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json<BookingBody>().seats).toHaveLength(10);
  });

  it('a 409 books nothing: the free seat of the request stays free', async () => {
    await api.book({
      showtimeId: showtimes.orbitTomorrow,
      seatIds: [seat(1, 1, 2)],
    });

    const res = await api.book(
      {
        showtimeId: showtimes.orbitTomorrow,
        seatIds: [seat(1, 1, 1), seat(1, 1, 2)],
      },
      { user: users.bob, key: 'bob-1' },
    );

    expect(res.statusCode).toBe(409);
    expect(errorOf(res).code).toBe('SEAT_TAKEN');
    expect(await api.takenSeats(showtimes.orbitTomorrow)).toEqual([
      seat(1, 1, 2),
    ]);
    expect((await api.myBookings(users.bob)).json()).toEqual([]);
  });

  it('the same seat can be booked for another showtime of the hall', async () => {
    const body = (showtimeId: string) => ({
      showtimeId,
      seatIds: [seat(1, 1, 1)],
    });
    expect((await api.book(body(showtimes.orbitTomorrow))).statusCode).toBe(
      201,
    );
    expect(
      (await api.book(body(showtimes.blueHarbor), { key: 'key-2' })).statusCode,
    ).toBe(201);
  });
});

describe('AC-3: book -> taken, cancel -> free, cancel again -> 200', () => {
  it('marks booked seats taken and frees them on cancel', async () => {
    const booked = await api.book({
      showtimeId: showtimes.orbitSoon,
      seatIds: [seat(2, 1, 1), seat(2, 2, 3)],
    });
    const { id } = booked.json<BookingBody>();
    expect(await api.takenSeats(showtimes.orbitSoon)).toEqual([
      seat(2, 1, 1),
      seat(2, 2, 3),
    ]);

    const cancelled = await api.cancel(id);
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json()).toEqual({
      ...booked.json<BookingBody>(),
      status: 'CANCELLED',
      seats: [],
    });
    expect(await api.takenSeats(showtimes.orbitSoon)).toEqual([]);

    // Freed seats can be booked again.
    const again = await api.book(
      { showtimeId: showtimes.orbitSoon, seatIds: [seat(2, 1, 1)] },
      { user: users.bob, key: 'bob-1' },
    );
    expect(again.statusCode).toBe(201);
  });

  it('cancelling an already cancelled booking is 200 with the same state, even after start', async () => {
    const { id } = (
      await api.book({
        showtimeId: showtimes.orbitSoon,
        seatIds: [seat(2, 1, 2)],
      })
    ).json<BookingBody>();
    const first = await api.cancel(id);

    expect((await api.cancel(id)).json()).toEqual(first.json());

    t.clock.set(minutes(3 * 60)); // orbitSoon started an hour ago
    const afterStart = await api.cancel(id);
    expect(afterStart.statusCode).toBe(200);
    expect(afterStart.json()).toEqual(first.json());
  });

  it('cancelling a RESERVED booking after start is 422 SHOWTIME_STARTED', async () => {
    const { id } = (
      await api.book({
        showtimeId: showtimes.orbitSoon,
        seatIds: [seat(2, 1, 2)],
      })
    ).json<BookingBody>();

    t.clock.set(minutes(2 * 60)); // exactly the start: started
    const res = await api.cancel(id);

    expect(res.statusCode).toBe(422);
    expect(errorOf(res).code).toBe('SHOWTIME_STARTED');
    expect(await api.takenSeats(showtimes.orbitSoon)).toEqual([seat(2, 1, 2)]);
  });
});

describe('FR-6: GET /me/bookings', () => {
  it('lists only my bookings, cancelled included, newest first, with movie title and start', async () => {
    const first = (
      await api.book(
        { showtimeId: showtimes.orbitTomorrow, seatIds: [seat(1, 1, 1)] },
        { key: 'a' },
      )
    ).json<BookingBody>();
    t.clock.set(minutes(1));
    const second = (
      await api.book(
        { showtimeId: showtimes.nightGarden, seatIds: [seat(2, 2, 2)] },
        { key: 'b' },
      )
    ).json<BookingBody>();
    await api.cancel(first.id);
    await api.book(
      { showtimeId: showtimes.orbitTomorrow, seatIds: [seat(1, 3, 1)] },
      { user: users.bob, key: 'a' },
    );

    const res = await api.myBookings();

    expect(res.statusCode).toBe(200);
    expect(res.json<MyBookingBody[]>()).toEqual([
      {
        ...second,
        createdAt: minutes(1).toISOString(),
        movieTitle: 'Night Garden',
        startsAt: '2026-06-02T15:00:00.000Z',
      },
      {
        ...first,
        status: 'CANCELLED',
        seats: [],
        movieTitle: 'Orbit Nine',
        startsAt: '2026-06-02T12:00:00.000Z',
      },
    ]);
  });

  it('orders bookings with the same createdAt by id desc', async () => {
    const ids: string[] = [];
    for (const [key, n] of [
      ['a', 1],
      ['b', 2],
      ['c', 3],
    ] as const) {
      const res = await api.book(
        { showtimeId: showtimes.blueHarbor, seatIds: [seat(1, 1, n)] },
        { key },
      );
      ids.push(res.json<BookingBody>().id);
    }

    const listed = (await api.myBookings()).json<MyBookingBody[]>();
    expect(listed.map((b) => b.id)).toEqual([...ids].sort().reverse());
  });

  it('returns [] for a user without bookings', async () => {
    const res = await api.myBookings(users.bob);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });
});
