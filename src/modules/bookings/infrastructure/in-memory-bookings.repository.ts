import { compareText } from '../../../shared/kernel/compare.js';
import type { Logger } from '../../../shared/logger.js';
import type {
  BookingRecord,
  BookingsRepository,
  IdempotencyRecord,
  NewBooking,
  SaveResult,
} from '../application/ports/bookings.repository.js';

/** `booking_seat` primary key `(showtime_id, seat_id)`. */
function seatSlot(showtimeId: string, seatId: string): string {
  return `${showtimeId}/${seatId}`;
}

/** `idempotency_key` primary key `(user_id, key)`; a UUID has no `/`. */
function keySlot(userId: string, key: string): string {
  return `${userId}/${key}`;
}

/**
 * In-memory `booking`, `booking_seat` and `idempotency_key`. There is no
 * rollback, so `save` re-checks the key and the seats and writes all
 * rows in one synchronous step: a failed save writes nothing, and no
 * parallel request can run in between (docs/api.md#idempotency).
 */
export class InMemoryBookingsRepository implements BookingsRepository {
  readonly #log: Logger;
  readonly #bookings = new Map<string, BookingRecord>();
  /** seatSlot -> booking id */
  readonly #bookingSeats = new Map<string, string>();
  readonly #keys = new Map<string, IdempotencyRecord>();

  constructor(log: Logger) {
    this.#log = log;
  }

  claimKey(booking: NewBooking): Promise<IdempotencyRecord | null> {
    const stored = this.#keys.get(
      keySlot(booking.userId, booking.idempotencyKey),
    );
    return Promise.resolve(stored ? { ...stored } : null);
  }

  save(booking: NewBooking): Promise<SaveResult> {
    // From here to the return: no await, so the checks and the writes
    // are one step.
    const key = keySlot(booking.userId, booking.idempotencyKey);
    if (this.#keys.has(key)) return Promise.resolve('key-taken');
    const slots = booking.seatIds.map((id) => seatSlot(booking.showtimeId, id));
    if (slots.some((slot) => this.#bookingSeats.has(slot))) {
      return Promise.resolve('seat-taken');
    }

    this.#keys.set(key, {
      requestHash: booking.requestHash,
      bookingId: booking.id,
    });
    this.#bookings.set(booking.id, {
      id: booking.id,
      userId: booking.userId,
      showtimeId: booking.showtimeId,
      status: 'RESERVED',
      seatIds: [...booking.seatIds],
      createdAt: new Date(booking.createdAt),
    });
    for (const slot of slots) this.#bookingSeats.set(slot, booking.id);

    this.#log.debug(
      { bookingId: booking.id, seats: slots.length },
      'booking rows written',
    );
    return Promise.resolve('created');
  }

  getById(id: string): Promise<BookingRecord | null> {
    const booking = this.#bookings.get(id);
    return Promise.resolve(booking ? structuredClone(booking) : null);
  }

  listByUser(userId: string): Promise<BookingRecord[]> {
    const list = [...this.#bookings.values()]
      .filter((b) => b.userId === userId)
      .sort(
        (a, b) =>
          b.createdAt.getTime() - a.createdAt.getTime() ||
          compareText(b.id, a.id),
      );
    return Promise.resolve(structuredClone(list));
  }

  takenSeatIds(showtimeId: string): Promise<string[]> {
    const taken: string[] = [];
    for (const booking of this.#bookings.values()) {
      if (booking.showtimeId === showtimeId) taken.push(...booking.seatIds);
    }
    return Promise.resolve(taken);
  }

  cancel(id: string): Promise<void> {
    const booking = this.#bookings.get(id);
    if (booking) {
      for (const seatId of booking.seatIds) {
        this.#bookingSeats.delete(seatSlot(booking.showtimeId, seatId));
      }
      booking.status = 'CANCELLED';
      booking.seatIds = [];
      this.#log.debug({ bookingId: id }, 'booking cancelled, seats freed');
    }
    return Promise.resolve();
  }
}
