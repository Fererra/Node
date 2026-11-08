import type { Clock } from '../../../shared/clock.js';
import { NotFoundError } from '../../../shared/errors.js';
import type { MoviesPort } from './ports/movies.port.js';
import type { SeatsPort } from './ports/seats.port.js';
import type { ShowtimesRepository } from './ports/showtimes.repository.js';
import type { ShowtimesService } from './showtimes.types.js';

/** A value another module must have; missing means broken data -> 500. */
function required<T>(map: Map<string, T>, id: string, what: string): T {
  const value = map.get(id);
  if (value === undefined) throw new Error(`${what} ${id} not found`);
  return value;
}

export function createShowtimesService(deps: {
  repository: ShowtimesRepository;
  movies: MoviesPort;
  seats: SeatsPort;
  clock: Clock;
}): ShowtimesService {
  const { repository, movies, seats, clock } = deps;

  /** One batch call: hall numbers by hall id. */
  async function hallNumbers(
    hallIds: readonly string[],
  ): Promise<Map<string, number>> {
    const halls = await seats.getHallsByIds([...new Set(hallIds)]);
    return new Map(halls.map((h) => [h.id, h.number]));
  }

  return {
    async listForMovie(movieId) {
      const [movie] = await movies.getByIds([movieId]);
      if (!movie) throw new NotFoundError('Movie');

      // "Future" is `startsAt > now`: the complement of hasStarted().
      const showtimes = await repository.listFutureByMovie(
        movieId,
        clock.now(),
      );
      const numbers = await hallNumbers(showtimes.map((s) => s.hallId));
      return showtimes.map((s) => ({
        id: s.id,
        startsAt: s.startsAt,
        hall: { id: s.hallId, number: required(numbers, s.hallId, 'Hall') },
      }));
    },

    async getByIds(ids) {
      if (ids.length === 0) return [];
      const showtimes = await repository.getByIds(ids);
      if (showtimes.length === 0) return [];

      const [numbers, titles] = await Promise.all([
        hallNumbers(showtimes.map((s) => s.hallId)),
        movies
          .getByIds([...new Set(showtimes.map((s) => s.movieId))])
          .then((list) => new Map(list.map((m) => [m.id, m.title]))),
      ]);
      return showtimes.map((s) => ({
        id: s.id,
        startsAt: s.startsAt,
        hallId: s.hallId,
        hallNumber: required(numbers, s.hallId, 'Hall'),
        movieTitle: required(titles, s.movieId, 'Movie'),
      }));
    },
  };
}
