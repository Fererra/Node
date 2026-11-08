import { sql } from 'drizzle-orm';
import type { Database } from './database.js';
import * as schema from './schema/index.js';

/** Every table, children first; one TRUNCATE empties all of them. */
const ALL_TABLES = [
  schema.idempotencyKey,
  schema.bookingSeat,
  schema.booking,
  schema.showtime,
  schema.movieGenre,
  schema.movie,
  schema.genre,
  schema.seat,
  schema.cinemaHall,
  schema.users,
];

/** Rows of the reference tables, the shape `buildSeed(now)` provides. */
export interface ReferenceRows {
  users: (typeof schema.users.$inferInsert)[];
  genres: (typeof schema.genre.$inferInsert)[];
  movies: (typeof schema.movie.$inferInsert)[];
  movieGenres: (typeof schema.movieGenre.$inferInsert)[];
  halls: (typeof schema.cinemaHall.$inferInsert)[];
  seats: (typeof schema.seat.$inferInsert)[];
  showtimes: (typeof schema.showtime.$inferInsert)[];
}

/** Empties every table. Used by `db:seed` and before each DB test. */
export async function truncateAll(db: Database): Promise<void> {
  await db.execute(
    sql`truncate table ${sql.join(
      ALL_TABLES.map((t) => sql`${t}`),
      sql`, `,
    )} restart identity cascade`,
  );
}

/** Replaces all data with `rows`, in one transaction. */
export function replaceAllRows(
  db: Database,
  rows: ReferenceRows,
): Promise<void> {
  return db.transaction(async (tx) => {
    await truncateAll(tx);
    await tx.insert(schema.users).values(rows.users);
    await tx.insert(schema.genre).values(rows.genres);
    await tx.insert(schema.movie).values(rows.movies);
    await tx.insert(schema.movieGenre).values(rows.movieGenres);
    await tx.insert(schema.cinemaHall).values(rows.halls);
    await tx.insert(schema.seat).values(rows.seats);
    await tx.insert(schema.showtime).values(rows.showtimes);
  });
}
