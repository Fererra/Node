import type { Database } from '../shared/db/database.js';
import { replaceAllRows } from '../shared/db/seed.js';
import type { Seed } from './seed.js';

/**
 * Replaces all data in the database with `seed` (`buildSeed(now)`). Used
 * by `db:seed` and before each DB test.
 */
export function loadSeed(db: Database, seed: Seed): Promise<void> {
  return replaceAllRows(db, {
    users: seed.users.users,
    genres: seed.movies.genres,
    movies: seed.movies.movies,
    movieGenres: seed.movies.movieGenres,
    halls: seed.seats.halls,
    seats: seed.seats.seats,
    showtimes: seed.showtimes.showtimes,
  });
}
