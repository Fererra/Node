// Spec 03 FR-3: the booking flow against a real server process, only
// through fetch. The database is reset and reseeded once per run, so each
// test uses its own seats of the first Orbit Nine showtime, and only the
// full-path test reads GET /me/bookings, with its own user (NFR-3): the
// order of the tests doesn't matter.
import { describe, expect, it } from 'vitest';
import {
  book,
  cancel,
  firstShowtimeOf,
  get,
  seatAt,
  type Booking,
  type ErrorBody,
  type MyBooking,
} from './api.js';
import { users } from './seed-ids.js';

const MOVIE = 'Orbit Nine';
const UNKNOWN_USER = '60000000-0000-4000-8000-000000000999';

describe('E2E: booking through a running server', () => {
  it('movies -> showtimes -> seats -> book -> taken -> my bookings -> cancel -> free', async () => {
    const showtime = await firstShowtimeOf(MOVIE);
    const seat = await seatAt(showtime.id, 1, 1);
    expect(seat.taken).toBe(false);

    const created = await book(
      { showtimeId: showtime.id, seatIds: [seat.id] },
      { user: users.alice, key: 'e2e-full-path' },
    );
    expect(created.status).toBe(201);
    const booking = created.body as Booking;
    expect(booking).toMatchObject({
      showtimeId: showtime.id,
      status: 'RESERVED',
      seats: [{ id: seat.id, row: 1, number: 1 }],
    });
    expect((await seatAt(showtime.id, 1, 1)).taken).toBe(true);

    const mine = await get<MyBooking[]>('/me/bookings', {
      'x-user-id': users.alice,
    });
    expect(mine.status).toBe(200);
    expect(mine.body).toEqual([
      { ...booking, movieTitle: MOVIE, startsAt: showtime.startsAt },
    ]);

    const cancelled = await cancel(booking.id, users.alice);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({
      id: booking.id,
      status: 'CANCELLED',
      seats: [],
    });
    expect((await seatAt(showtime.id, 1, 1)).taken).toBe(false);
  });

  it.each([
    ['without X-User-Id', undefined],
    ['with an unknown user', UNKNOWN_USER],
  ])('401 %s, nothing booked', async (_name, user) => {
    const showtime = await firstShowtimeOf(MOVIE);
    const seat = await seatAt(showtime.id, 1, 2);

    const res = await book(
      { showtimeId: showtime.id, seatIds: [seat.id] },
      { user, key: 'e2e-401' },
    );

    expect(res.status).toBe(401);
    expect((res.body as ErrorBody).error.code).toBe('UNAUTHORIZED');
    expect((await seatAt(showtime.id, 1, 2)).taken).toBe(false);
  });

  it('409 when the seat is already taken', async () => {
    const showtime = await firstShowtimeOf(MOVIE);
    const seat = await seatAt(showtime.id, 1, 3);
    const body = { showtimeId: showtime.id, seatIds: [seat.id] };

    const first = await book(body, { user: users.bob, key: 'e2e-409-first' });
    expect(first.status).toBe(201);

    const second = await book(body, {
      user: users.bob,
      key: 'e2e-409-second',
    });
    expect(second.status).toBe(409);
    expect((second.body as ErrorBody).error.code).toBe('SEAT_TAKEN');
  });

  it('a replay with the same key is 201 with the same booking; the key with another request is 422', async () => {
    const showtime = await firstShowtimeOf(MOVIE);
    const seat = await seatAt(showtime.id, 2, 1);
    const other = await seatAt(showtime.id, 2, 2);
    const key = 'e2e-replay';

    const first = await book(
      { showtimeId: showtime.id, seatIds: [seat.id] },
      { user: users.bob, key },
    );
    expect(first.status).toBe(201);

    const replay = await book(
      { showtimeId: showtime.id, seatIds: [seat.id] },
      { user: users.bob, key },
    );
    expect(replay.status).toBe(201);
    expect(replay.body).toEqual(first.body);

    const reused = await book(
      { showtimeId: showtime.id, seatIds: [other.id] },
      { user: users.bob, key },
    );
    expect(reused.status).toBe(422);
    expect((reused.body as ErrorBody).error.code).toBe(
      'IDEMPOTENCY_KEY_REUSED',
    );
    expect((await seatAt(showtime.id, 2, 2)).taken).toBe(false);
  });
});
