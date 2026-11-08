import { randomUUID } from 'node:crypto';
import type { Clock } from '../../../shared/clock.js';
import {
  getContext,
  setCurrentUser,
  type CurrentUser,
} from '../../../shared/context.js';
import { NotFoundError, UnauthorizedError } from '../../../shared/errors.js';
import { hasStarted } from '../../../shared/kernel/time.js';
import { isUuid } from '../../../shared/kernel/uuid.js';
import type { Logger } from '../../../shared/logger.js';
import type { UnitOfWork } from '../../../shared/unit-of-work.js';
import { requestHash, sortSeatIds } from '../domain/booking.js';
import type { BookingDto, BookingsService } from './bookings.types.js';
import {
  IdempotencyKeyReusedError,
  SeatNotInHallError,
  SeatTakenError,
  ShowtimeStartedError,
} from './errors.js';
import type {
  BookingRecord,
  BookingsRepository,
  IdempotencyRecord,
  NewBooking,
} from './ports/bookings.repository.js';
import type { SeatsPort } from './ports/seats.port.js';
import type { ShowtimesPort } from './ports/showtimes.port.js';
import type { UsersPort } from './ports/users.port.js';

export interface BookingsServiceDeps {
  repository: BookingsRepository;
  showtimes: ShowtimesPort;
  seats: SeatsPort;
  users: UsersPort;
  uow: UnitOfWork;
  clock: Clock;
  log: Logger;
}

type SeatInfo = BookingDto['seats'][number];

/** Access check: every bookings use case except FR-3 needs a user. */
function requireUser(): CurrentUser {
  const user = getContext()?.user;
  if (!user) throw new UnauthorizedError();
  return user;
}

/** A value the data must have; missing means broken data -> 500. */
function required<T>(value: T | undefined | null, what: string): T {
  if (value === undefined || value === null) {
    throw new Error(`${what} not found`);
  }
  return value;
}

function toDto(
  booking: BookingRecord,
  seatsById: ReadonlyMap<string, SeatInfo>,
): BookingDto {
  return {
    id: booking.id,
    showtimeId: booking.showtimeId,
    status: booking.status,
    seats: booking.seatIds
      .map((id) => required(seatsById.get(id), `Seat ${id}`))
      .sort((a, b) => a.row - b.row || a.number - b.number),
    createdAt: booking.createdAt,
  };
}

export function createBookingsService(
  deps: BookingsServiceDeps,
): BookingsService {
  const { repository, showtimes, seats, users, uow, clock, log } = deps;

  /** One batch call for the seats of any number of bookings. */
  async function seatsOf(
    bookings: readonly BookingRecord[],
  ): Promise<Map<string, SeatInfo>> {
    const ids = [...new Set(bookings.flatMap((b) => b.seatIds))];
    const list = await seats.getByIds(ids);
    return new Map(
      list.map((s) => [s.id, { id: s.id, row: s.row, number: s.number }]),
    );
  }

  async function bookingDto(booking: BookingRecord): Promise<BookingDto> {
    return toDto(booking, await seatsOf([booking]));
  }

  /** Same request -> the booking's current state; other request -> 422. */
  async function replay(
    stored: IdempotencyRecord,
    booking: NewBooking,
  ): Promise<BookingDto> {
    if (stored.requestHash !== booking.requestHash) {
      throw new IdempotencyKeyReusedError();
    }
    const existing = required(
      await repository.getById(stored.bookingId),
      `Booking ${stored.bookingId}`,
    );
    log.info({ bookingId: existing.id }, 'booking replayed');
    return bookingDto(existing);
  }

  return {
    async authenticate(userId) {
      if (userId === undefined || !isUuid(userId)) {
        throw new UnauthorizedError();
      }
      const user = await users.getById(userId.toLowerCase());
      if (!user) throw new UnauthorizedError();
      setCurrentUser(user);
    },

    async listShowtimeSeats(showtimeId) {
      const [showtime] = await showtimes.getByIds([showtimeId]);
      if (!showtime) throw new NotFoundError('Showtime');
      const [hallSeats, taken] = await Promise.all([
        seats.getByHall(showtime.hallId),
        repository.takenSeatIds(showtimeId).then((ids) => new Set(ids)),
      ]);
      return hallSeats.map((s) => ({ ...s, taken: taken.has(s.id) }));
    },

    async create({ showtimeId, seatIds, idempotencyKey }) {
      const user = requireUser();
      const sorted = sortSeatIds(seatIds);
      const booking: NewBooking = {
        id: randomUUID(),
        userId: user.id,
        showtimeId,
        seatIds: sorted,
        createdAt: clock.now(),
        idempotencyKey,
        requestHash: requestHash(showtimeId, sorted),
      };

      // Order of checks: docs/api.md#order-of-checks. All of them run
      // inside the unit of work (ADR-0004).
      return uow.run(async () => {
        const stored = await repository.claimKey(booking);
        if (stored) return replay(stored, booking);

        const [showtime] = await showtimes.getByIds([showtimeId]);
        if (!showtime) throw new NotFoundError('Showtime');
        if (hasStarted(showtime.startsAt, clock.now())) {
          throw new ShowtimeStartedError();
        }

        const found = await seats.getByIds(sorted);
        if (
          found.length !== sorted.length ||
          found.some((s) => s.hallId !== showtime.hallId)
        ) {
          throw new SeatNotInHallError();
        }

        const result = await repository.save(booking);
        if (result === 'seat-taken') throw new SeatTakenError();
        if (result === 'key-taken') {
          // A parallel request with this key won: answer like a replay.
          const winner = required(
            await repository.claimKey(booking),
            'Idempotency key',
          );
          return replay(winner, booking);
        }

        log.info(
          { bookingId: booking.id, showtimeId, seats: sorted.length },
          'booking created',
        );
        return toDto(
          { ...booking, status: 'RESERVED' },
          new Map(
            found.map((s) => [
              s.id,
              { id: s.id, row: s.row, number: s.number },
            ]),
          ),
        );
      });
    },

    async cancel(bookingId) {
      const user = requireUser();
      return uow.run(async () => {
        const booking = await repository.getById(bookingId);
        // Someone else's booking is reported as missing, not forbidden.
        if (!booking || booking.userId !== user.id) {
          throw new NotFoundError('Booking');
        }
        // Already cancelled: 200 with the same state, even after start.
        if (booking.status === 'CANCELLED') return bookingDto(booking);

        const [showtime] = await showtimes.getByIds([booking.showtimeId]);
        const startsAt = required(
          showtime,
          `Showtime ${booking.showtimeId}`,
        ).startsAt;
        if (hasStarted(startsAt, clock.now())) throw new ShowtimeStartedError();

        await repository.cancel(booking.id);
        log.info({ bookingId: booking.id }, 'booking cancelled');
        return toDto(
          { ...booking, status: 'CANCELLED', seatIds: [] },
          new Map(),
        );
      });
    },

    async listMine() {
      const user = requireUser();
      const bookings = await repository.listByUser(user.id);
      if (bookings.length === 0) return [];

      const [showtimesById, seatsById] = await Promise.all([
        showtimes
          .getByIds([...new Set(bookings.map((b) => b.showtimeId))])
          .then((list) => new Map(list.map((s) => [s.id, s]))),
        seatsOf(bookings),
      ]);
      return bookings.map((booking) => {
        const showtime = required(
          showtimesById.get(booking.showtimeId),
          `Showtime ${booking.showtimeId}`,
        );
        return {
          ...toDto(booking, seatsById),
          movieTitle: showtime.movieTitle,
          startsAt: showtime.startsAt,
        };
      });
    },
  };
}
