import type { BookingStatus } from '../../domain/booking.js';

export interface BookingRecord {
  id: string;
  userId: string;
  showtimeId: string;
  status: BookingStatus;
  /** Seats the booking holds, sorted; empty once cancelled. */
  seatIds: string[];
  createdAt: Date;
}

/** A booking to create, with the idempotency key that creates it. */
export interface NewBooking {
  id: string;
  userId: string;
  showtimeId: string;
  /** Sorted (insert order). */
  seatIds: string[];
  createdAt: Date;
  idempotencyKey: string;
  requestHash: string;
}

export interface IdempotencyRecord {
  requestHash: string;
  bookingId: string;
}

/**
 * - `created`: the key, the booking and its seats are written;
 * - `seat-taken`: a seat is already booked for the showtime;
 * - `key-taken`: the key was stored meanwhile by a parallel request.
 * Expected conflicts are results, not exceptions (ADR-0004).
 */
export type SaveResult = 'created' | 'seat-taken' | 'key-taken';

export interface BookingsRepository {
  /**
   * Returns the stored key `(userId, idempotencyKey)`, or `null` if this
   * request may create the booking. PostgreSQL claims the key here
   * (`INSERT … ON CONFLICT DO NOTHING RETURNING`); in memory it only
   * looks the key up and `save` writes it (docs/api.md#idempotency).
   */
  claimKey(booking: NewBooking): Promise<IdempotencyRecord | null>;
  /** Writes the booking and its seats; nothing is written unless `created`. */
  save(booking: NewBooking): Promise<SaveResult>;
  getById(id: string): Promise<BookingRecord | null>;
  /** The user's bookings by `createdAt` desc, then `id` desc. */
  listByUser(userId: string): Promise<BookingRecord[]>;
  /** Ids of the seats booked for the showtime. */
  takenSeatIds(showtimeId: string): Promise<string[]>;
  /** Sets `CANCELLED` and frees the seats. */
  cancel(id: string): Promise<void>;
}
