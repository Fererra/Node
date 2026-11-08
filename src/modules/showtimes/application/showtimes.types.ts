/** `GET /movies/:id/showtimes` item (docs/api.md). */
export interface MovieShowtimeDto {
  id: string;
  startsAt: Date;
  hall: { id: string; number: number };
}

/** What other modules get through `showtimes.getByIds`. */
export interface ShowtimeSummary {
  id: string;
  startsAt: Date;
  hallId: string;
  hallNumber: number;
  movieTitle: string;
}

export interface ShowtimesService {
  /** Future showtimes of a movie by `startsAt`; unknown movie -> 404. */
  listForMovie(movieId: string): Promise<MovieShowtimeDto[]>;
  /** Showtimes with the given ids; unknown ids are skipped. */
  getByIds(ids: readonly string[]): Promise<ShowtimeSummary[]>;
}
