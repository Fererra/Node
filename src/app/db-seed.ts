import { sql } from 'drizzle-orm';
import type { Database } from '../shared/db/database.js';
import * as schema from '../shared/db/schema/index.js';
import type { Seed } from './seed.js';

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

/** Empties every table. Used by `db:seed` and before each DB test. */
export async function truncateAll(db: Database): Promise<void> {
  await db.execute(
    sql`truncate table ${sql.join(
      ALL_TABLES.map((t) => sql`${t}`),
      sql`, `,
    )} restart identity cascade`,
  );
}

/**
 * Replaces all data with `seed` (`buildSeed(now)`) in one transaction.
 * Writes every module's tables, so it lives in the composition root, not
 * in a module.
 */
export function loadSeed(db: Database, seed: Seed): Promise<void> {
  return db.transaction(async (tx) => {
    await truncateAll(tx);
    await tx.insert(schema.users).values(seed.users.users);
    await tx.insert(schema.genre).values(seed.movies.genres);
    await tx.insert(schema.movie).values(seed.movies.movies);
    await tx.insert(schema.movieGenre).values(seed.movies.movieGenres);
    await tx.insert(schema.cinemaHall).values(seed.seats.halls);
    await tx.insert(schema.seat).values(seed.seats.seats);
    await tx.insert(schema.showtime).values(seed.showtimes.showtimes);
  });
}
