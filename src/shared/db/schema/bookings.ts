// Tables owned by `bookings` (docs/architecture.md#physical-schema).
import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { seat } from './seats.js';
import { showtime } from './showtimes.js';
import { users } from './users.js';

export const bookingStatus = pgEnum('booking_status', [
  'RESERVED',
  'CANCELLED',
]);

export const booking = pgTable(
  'booking',
  {
    id: uuid('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    showtimeId: uuid('showtime_id')
      .notNull()
      .references(() => showtime.id),
    status: bookingStatus('status').notNull(),
    // From Clock, not a database default.
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    // Target of booking_seat's composite FK.
    unique('booking_id_showtime_id_key').on(t.id, t.showtimeId),
    index('booking_user_id_created_at_idx').on(t.userId, t.createdAt),
  ],
);

export const bookingSeat = pgTable(
  'booking_seat',
  {
    showtimeId: uuid('showtime_id').notNull(),
    seatId: uuid('seat_id')
      .notNull()
      .references(() => seat.id),
    bookingId: uuid('booking_id').notNull(),
  },
  (t) => [
    // A seat can't be booked twice for one showtime.
    primaryKey({ columns: [t.showtimeId, t.seatId] }),
    // All seats of a booking have the booking's showtime.
    foreignKey({
      name: 'booking_seat_booking_fk',
      columns: [t.bookingId, t.showtimeId],
      foreignColumns: [booking.id, booking.showtimeId],
    }),
    index('booking_seat_booking_id_idx').on(t.bookingId),
  ],
);

/**
 * `booking_id`'s FK is DEFERRABLE INITIALLY DEFERRED, so the key can be
 * claimed before the booking exists. Drizzle can't express deferrable
 * foreign keys: a hand-written migration in drizzle/ alters it.
 */
export const IDEMPOTENCY_KEY_BOOKING_FK = 'idempotency_key_booking_fk';

export const idempotencyKey = pgTable(
  'idempotency_key',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    key: text('key').notNull(),
    requestHash: text('request_hash').notNull(),
    bookingId: uuid('booking_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.key] }),
    foreignKey({
      name: IDEMPOTENCY_KEY_BOOKING_FK,
      columns: [t.bookingId],
      foreignColumns: [booking.id],
    }),
    check(
      'idempotency_key_key_length',
      sql`char_length(${t.key}) between 1 and 255`,
    ),
  ],
);
