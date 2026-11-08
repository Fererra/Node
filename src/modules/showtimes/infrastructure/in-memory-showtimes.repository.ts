import { compareText } from '../../../shared/kernel/compare.js';
import { hasStarted } from '../../../shared/kernel/time.js';
import type {
  ShowtimeRecord,
  ShowtimesRepository,
} from '../application/ports/showtimes.repository.js';
import type { ShowtimesSeed } from './showtimes.seed.js';

export class InMemoryShowtimesRepository implements ShowtimesRepository {
  readonly #showtimes: ShowtimeRecord[];

  constructor(seed: ShowtimesSeed) {
    this.#showtimes = structuredClone(seed.showtimes);
  }

  listFutureByMovie(movieId: string, now: Date): Promise<ShowtimeRecord[]> {
    return Promise.resolve(
      this.#showtimes
        .filter((s) => s.movieId === movieId && !hasStarted(s.startsAt, now))
        .sort(
          (a, b) =>
            a.startsAt.getTime() - b.startsAt.getTime() ||
            compareText(a.id, b.id),
        )
        .map((s) => structuredClone(s)),
    );
  }

  getByIds(ids: readonly string[]): Promise<ShowtimeRecord[]> {
    const wanted = new Set(ids);
    return Promise.resolve(
      this.#showtimes
        .filter((s) => wanted.has(s.id))
        .map((s) => structuredClone(s)),
    );
  }
}
