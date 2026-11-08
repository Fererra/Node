// Table owned by `showtimes` (docs/architecture.md#physical-schema).
import { index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { movie } from './movies.js';
import { cinemaHall } from './seats.js';

export const showtime = pgTable(
  'showtime',
  {
    id: uuid('id').primaryKey(),
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movie.id),
    hallId: uuid('hall_id')
      .notNull()
      .references(() => cinemaHall.id),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
  },
  (t) => [index('showtime_movie_id_starts_at_idx').on(t.movieId, t.startsAt)],
);
