import { and, asc, eq, gt, inArray } from 'drizzle-orm';
import type { Database } from '../../../shared/db/database.js';
import { executor } from '../../../shared/db/executor.js';
import { showtime } from '../../../shared/db/schema/showtimes.js';
import type {
  ShowtimeRecord,
  ShowtimesRepository,
} from '../application/ports/showtimes.repository.js';

const columns = {
  id: showtime.id,
  movieId: showtime.movieId,
  hallId: showtime.hallId,
  startsAt: showtime.startsAt,
};

export class DrizzleShowtimesRepository implements ShowtimesRepository {
  readonly #db: Database;

  constructor(db: Database) {
    this.#db = db;
  }

  /** "Future" is `starts_at > now`: the complement of `hasStarted`. */
  listFutureByMovie(movieId: string, now: Date): Promise<ShowtimeRecord[]> {
    return executor(this.#db)
      .select(columns)
      .from(showtime)
      .where(and(eq(showtime.movieId, movieId), gt(showtime.startsAt, now)))
      .orderBy(asc(showtime.startsAt), asc(showtime.id));
  }

  getByIds(ids: readonly string[]): Promise<ShowtimeRecord[]> {
    return executor(this.#db)
      .select(columns)
      .from(showtime)
      .where(inArray(showtime.id, [...ids]));
  }
}
