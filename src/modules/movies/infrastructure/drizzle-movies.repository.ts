import { eq, inArray, sql, type SQLWrapper } from 'drizzle-orm';
import type { Database } from '../../../shared/db/database.js';
import { executor } from '../../../shared/db/executor.js';
import { genre, movie, movieGenre } from '../../../shared/db/schema/movies.js';
import type { MoviesRepository } from '../application/ports/movies.repository.js';
import type { MovieDto, MovieSummary } from '../application/movies.types.js';

export type { PostgresStorage } from '../../../shared/db/database.js';

/** Text order by code point, like `compareText` in memory. */
const byCodePoint = (column: SQLWrapper) => sql`${column} collate "C"`;

/** Genre names of the movie, by name; `{}` for a movie without genres. */
const genreNames = sql<string[]>`coalesce(
  array_agg(${genre.name} order by ${byCodePoint(genre.name)})
    filter (where ${genre.name} is not null),
  '{}'
)`;

export class DrizzleMoviesRepository implements MoviesRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  /** One query: genres are aggregated per movie. */
  listWithGenres(): Promise<MovieDto[]> {
    return executor(this.#db)
      .select({
        id: movie.id,
        title: movie.title,
        durationMin: movie.durationMin,
        ageLimit: movie.ageLimit,
        genres: genreNames,
      })
      .from(movie)
      .leftJoin(movieGenre, eq(movieGenre.movieId, movie.id))
      .leftJoin(genre, eq(genre.id, movieGenre.genreId))
      .groupBy(movie.id)
      .orderBy(byCodePoint(movie.title), movie.id);
  }

  getByIds(ids: readonly string[]): Promise<MovieSummary[]> {
    return executor(this.#db)
      .select({ id: movie.id, title: movie.title })
      .from(movie)
      .where(inArray(movie.id, [...ids]));
  }
}
