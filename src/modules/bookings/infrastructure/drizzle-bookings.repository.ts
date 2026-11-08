import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import type { Database } from '../../../shared/db/database.js';
import { executor } from '../../../shared/db/executor.js';
import {
  booking,
  bookingSeat,
  idempotencyKey,
} from '../../../shared/db/schema/bookings.js';
import { compareText } from '../../../shared/kernel/compare.js';
import type { Logger } from '../../../shared/logger.js';
import type {
  BookingRecord,
  BookingsRepository,
  IdempotencyRecord,
  NewBooking,
  SaveResult,
} from '../application/ports/bookings.repository.js';

export type { PostgresStorage } from '../../../shared/db/database.js';

/** The booking's seat ids, sorted, as one column: no query per booking. */
const seatIdsColumn = sql<string[]>`coalesce(
  (select array_agg(${bookingSeat.seatId}::text order by ${bookingSeat.seatId})
     from ${bookingSeat}
    where ${bookingSeat.bookingId} = ${booking.id}),
  '{}'
)`;

/**
 * `booking`, `booking_seat` and `idempotency_key` in PostgreSQL. Writes
 * run in the caller's unit of work; expected conflicts are detected from
 * row counts (`ON CONFLICT DO NOTHING`), never by catching errors
 * (docs/api.md#idempotency, ADR-0004).
 */
export class DrizzleBookingsRepository implements BookingsRepository {
  readonly #db: Database;
  readonly #log: Logger;

  constructor(db: Database, log: Logger) {
    this.#db = db;
    this.#log = log;
  }

  /**
   * Claims `(user_id, key)` for this booking. The FK to `booking` is
   * deferred, so the key goes in first. A parallel claim of the same key
   * waits here for the other transaction; if that one committed, the
   * insert returns nothing and the stored key is read (READ COMMITTED
   * sees the commit); if it rolled back, this claim succeeds.
   */
  async claimKey(newBooking: NewBooking): Promise<IdempotencyRecord | null> {
    const db = executor(this.#db);
    const claimed = await db
      .insert(idempotencyKey)
      .values({
        userId: newBooking.userId,
        key: newBooking.idempotencyKey,
        requestHash: newBooking.requestHash,
        bookingId: newBooking.id,
        createdAt: newBooking.createdAt,
      })
      .onConflictDoNothing()
      .returning({ key: idempotencyKey.key });
    if (claimed.length === 1) return null;

    const [stored] = await db
      .select({
        requestHash: idempotencyKey.requestHash,
        bookingId: idempotencyKey.bookingId,
      })
      .from(idempotencyKey)
      .where(
        and(
          eq(idempotencyKey.userId, newBooking.userId),
          eq(idempotencyKey.key, newBooking.idempotencyKey),
        ),
      );
    if (!stored) throw new Error('Idempotency key conflict without a row');
    return stored;
  }

  /**
   * Inserts the booking, then its seats sorted by `seat_id`, so parallel
   * bookings take seat locks in one order and can't deadlock. Fewer
   * inserted rows than seats means a seat is taken; the service then
   * throws, which rolls the whole unit of work back.
   */
  async save(newBooking: NewBooking): Promise<SaveResult> {
    const db = executor(this.#db);
    await db.insert(booking).values({
      id: newBooking.id,
      userId: newBooking.userId,
      showtimeId: newBooking.showtimeId,
      status: 'RESERVED',
      createdAt: newBooking.createdAt,
    });

    const sorted = [...newBooking.seatIds].sort(compareText);
    const inserted = await db
      .insert(bookingSeat)
      .values(
        sorted.map((seatId) => ({
          showtimeId: newBooking.showtimeId,
          seatId,
          bookingId: newBooking.id,
        })),
      )
      .onConflictDoNothing()
      .returning({ seatId: bookingSeat.seatId });

    if (inserted.length < sorted.length) return 'seat-taken';
    this.#log.debug(
      { bookingId: newBooking.id, seats: inserted.length },
      'booking rows written',
    );
    return 'created';
  }

  async getById(id: string): Promise<BookingRecord | null> {
    const [found] = await this.#select(eq(booking.id, id));
    return found ?? null;
  }

  listByUser(userId: string): Promise<BookingRecord[]> {
    return this.#select(eq(booking.userId, userId)).orderBy(
      desc(booking.createdAt),
      desc(booking.id),
    );
  }

  async takenSeatIds(showtimeId: string): Promise<string[]> {
    const rows = await executor(this.#db)
      .select({ seatId: bookingSeat.seatId })
      .from(bookingSeat)
      .where(eq(bookingSeat.showtimeId, showtimeId));
    return rows.map((r) => r.seatId);
  }

  async cancel(id: string): Promise<void> {
    const db = executor(this.#db);
    await db
      .update(booking)
      .set({ status: 'CANCELLED' })
      .where(eq(booking.id, id));
    await db.delete(bookingSeat).where(eq(bookingSeat.bookingId, id));
    this.#log.debug({ bookingId: id }, 'booking cancelled, seats freed');
  }

  #select(where: SQL) {
    return executor(this.#db)
      .select({
        id: booking.id,
        userId: booking.userId,
        showtimeId: booking.showtimeId,
        status: booking.status,
        seatIds: seatIdsColumn,
        createdAt: booking.createdAt,
      })
      .from(booking)
      .where(where)
      .$dynamic();
  }
}
