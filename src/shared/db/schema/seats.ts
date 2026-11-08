// Tables owned by `seats` (docs/architecture.md#physical-schema).
import { integer, pgEnum, pgTable, unique, uuid } from 'drizzle-orm/pg-core';

export const seatType = pgEnum('seat_type', ['STANDARD', 'VIP']);

export const cinemaHall = pgTable('cinema_hall', {
  id: uuid('id').primaryKey(),
  hallNumber: integer('hall_number').notNull().unique(),
});

export const seat = pgTable(
  'seat',
  {
    id: uuid('id').primaryKey(),
    hallId: uuid('hall_id')
      .notNull()
      .references(() => cinemaHall.id),
    row: integer('row').notNull(),
    number: integer('number').notNull(),
    seatType: seatType('seat_type').notNull(),
  },
  (t) => [unique('seat_hall_row_number_key').on(t.hallId, t.row, t.number)],
);
