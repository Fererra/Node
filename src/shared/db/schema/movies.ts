// Tables owned by `movies` (docs/architecture.md#physical-schema).
import { sql } from 'drizzle-orm';
import {
  check,
  integer,
  pgTable,
  primaryKey,
  text,
  uuid,
} from 'drizzle-orm/pg-core';

export const genre = pgTable('genre', {
  id: uuid('id').primaryKey(),
  name: text('name').notNull().unique(),
});

export const movie = pgTable(
  'movie',
  {
    id: uuid('id').primaryKey(),
    title: text('title').notNull(),
    durationMin: integer('duration_min').notNull(),
    ageLimit: integer('age_limit').notNull(),
    releaseYear: integer('release_year').notNull(),
    description: text('description').notNull(),
  },
  (t) => [check('movie_duration_min_positive', sql`${t.durationMin} > 0`)],
);

export const movieGenre = pgTable(
  'movie_genre',
  {
    movieId: uuid('movie_id')
      .notNull()
      .references(() => movie.id),
    genreId: uuid('genre_id')
      .notNull()
      .references(() => genre.id),
  },
  (t) => [primaryKey({ columns: [t.movieId, t.genreId] })],
);
