// Service tests with fake ports for two gaps found by mutation testing
// (docs/mutation.md, "Top-3 real gaps"). The HTTP scenarios can't reach
// them: seed seat ids encode hall, row and number, so sorting by id
// already gives the row/number order (R1), and the in-memory repository
// never reports `key-taken` (R3).
import { describe, expect, it, vi } from 'vitest';
import { createBookingsService } from '../../src/modules/bookings/application/bookings.service.js';
import type {
  BookingRecord,
  BookingsRepository,
  IdempotencyRecord,
  NewBooking,
  SaveResult,
} from '../../src/modules/bookings/application/ports/bookings.repository.js';
import type { SeatsPort } from '../../src/modules/bookings/application/ports/seats.port.js';
import type { ShowtimesPort } from '../../src/modules/bookings/application/ports/showtimes.port.js';
import type { UsersPort } from '../../src/modules/bookings/application/ports/users.port.js';
import { fixedClock } from '../../src/shared/clock.js';
import { runWithContext } from '../../src/shared/context.js';
import type { Logger } from '../../src/shared/logger.js';
import { inMemoryUnitOfWork } from '../../src/shared/unit-of-work.js';

const NOW = new Date('2026-06-01T12:00:00.000Z');
const USER = { id: 'user-1', name: 'Alice' };
const HALL_ID = 'hall-1';
const SHOWTIME_ID = 'showtime-1';

const silent: Logger = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};

/**
 * Seats whose ids sort in a different order than by row and number:
 * by id the order is 1/3, 2/1, 1/1.
 */
const SEATS = [
  { id: 'seat-a', hallId: HALL_ID, row: 1, number: 3 },
  { id: 'seat-b', hallId: HALL_ID, row: 2, number: 1 },
  { id: 'seat-c', hallId: HALL_ID, row: 1, number: 1 },
];

const showtimes: ShowtimesPort = {
  getByIds: (ids) =>
    Promise.resolve(
      ids.includes(SHOWTIME_ID)
        ? [
            {
              id: SHOWTIME_ID,
              startsAt: new Date(NOW.getTime() + 24 * 60 * 60 * 1000),
              hallId: HALL_ID,
              hallNumber: 1,
              movieTitle: 'Orbit',
            },
          ]
        : [],
    ),
};

const seats: SeatsPort = {
  // Not used by `create`.
  getByHall: () => Promise.resolve([]),
  getByIds: (ids) => Promise.resolve(SEATS.filter((s) => ids.includes(s.id))),
};

const users: UsersPort = {
  getById: (id) => Promise.resolve(id === USER.id ? USER : null),
};

/** A repository that creates every booking; tests override methods. */
function fakeRepository(
  overrides: Partial<BookingsRepository> = {},
): BookingsRepository {
  return {
    claimKey: () => Promise.resolve(null),
    save: () => Promise.resolve<SaveResult>('created'),
    getById: () => Promise.resolve(null),
    listByUser: () => Promise.resolve([]),
    takenSeatIds: () => Promise.resolve([]),
    cancel: () => Promise.resolve(),
    ...overrides,
  };
}

function service(repository: BookingsRepository) {
  return createBookingsService({
    repository,
    showtimes,
    seats,
    users,
    uow: inMemoryUnitOfWork,
    clock: fixedClock(NOW),
    log: silent,
  });
}

/** Runs `fn` as the logged-in user, like a request after `authenticate`. */
function asUser<T>(fn: () => Promise<T>): Promise<T> {
  return runWithContext({ requestId: 'req-1', user: { ...USER } }, fn);
}

describe('R1: seats of a booking are listed by row and number', () => {
  it('books 2/1, 1/3, 1/1 and answers 1/1, 1/3, 2/1', async () => {
    const bookings = service(fakeRepository());

    const booking = await asUser(() =>
      bookings.create({
        showtimeId: SHOWTIME_ID,
        seatIds: ['seat-b', 'seat-a', 'seat-c'],
        idempotencyKey: 'key-1',
      }),
    );

    expect(booking.seats).toEqual([
      { id: 'seat-c', row: 1, number: 1 },
      { id: 'seat-a', row: 1, number: 3 },
      { id: 'seat-b', row: 2, number: 1 },
    ]);
  });
});

describe('R3: a request that lost the idempotency key to a parallel one', () => {
  it("answers with the winner's booking (a replay), not its own", async () => {
    const winner: BookingRecord = {
      id: 'winner-booking',
      userId: USER.id,
      showtimeId: SHOWTIME_ID,
      status: 'RESERVED',
      seatIds: ['seat-a', 'seat-b', 'seat-c'],
      createdAt: new Date(NOW.getTime() - 1000),
    };
    // First lookup: the key is free. `save` then finds it taken by the
    // parallel request, and the second lookup returns that request's key.
    const claimKey = vi
      .fn<(booking: NewBooking) => Promise<IdempotencyRecord | null>>()
      .mockResolvedValueOnce(null)
      .mockImplementationOnce((booking) =>
        Promise.resolve({
          requestHash: booking.requestHash,
          bookingId: winner.id,
        }),
      );
    const save = vi
      .fn<(booking: NewBooking) => Promise<SaveResult>>()
      .mockResolvedValue('key-taken');
    const bookings = service(
      fakeRepository({
        claimKey,
        save,
        getById: (id) => Promise.resolve(id === winner.id ? winner : null),
      }),
    );

    const booking = await asUser(() =>
      bookings.create({
        showtimeId: SHOWTIME_ID,
        seatIds: ['seat-a', 'seat-b', 'seat-c'],
        idempotencyKey: 'key-1',
      }),
    );

    const losing = save.mock.calls[0]?.[0];
    expect(losing).toBeDefined();
    expect(booking.id).not.toBe(losing?.id);
    expect(booking).toEqual({
      id: winner.id,
      showtimeId: SHOWTIME_ID,
      status: 'RESERVED',
      seats: [
        { id: 'seat-c', row: 1, number: 1 },
        { id: 'seat-a', row: 1, number: 3 },
        { id: 'seat-b', row: 2, number: 1 },
      ],
      createdAt: winner.createdAt,
    });
    expect(claimKey).toHaveBeenCalledTimes(2);
  });
});
