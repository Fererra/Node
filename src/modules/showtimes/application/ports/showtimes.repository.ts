export interface ShowtimeRecord {
  id: string;
  movieId: string;
  hallId: string;
  startsAt: Date;
}

export interface ShowtimesRepository {
  /** Showtimes of the movie with `startsAt > now`, by `startsAt`, then id. */
  listFutureByMovie(movieId: string, now: Date): Promise<ShowtimeRecord[]>;
  /** Showtimes with the given ids; unknown ids are skipped. */
  getByIds(ids: readonly string[]): Promise<ShowtimeRecord[]>;
}
