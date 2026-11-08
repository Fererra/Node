import type { Clock } from '../../shared/clock.js';
import type { AppModule } from '../../shared/module.js';
import type { MoviesPort } from './application/ports/movies.port.js';
import type { SeatsPort } from './application/ports/seats.port.js';
import { createShowtimesService } from './application/showtimes.service.js';
import type { ShowtimesService } from './application/showtimes.types.js';
import { showtimesRoutes } from './http/showtimes.routes.js';
import { InMemoryShowtimesRepository } from './infrastructure/in-memory-showtimes.repository.js';
import type { ShowtimesSeed } from './infrastructure/showtimes.seed.js';

export type {
  MovieShowtimeDto,
  ShowtimeSummary,
  ShowtimesService,
} from './application/showtimes.types.js';
export type { ShowtimesSeed } from './infrastructure/showtimes.seed.js';

/** Where the module keeps its data; `postgres` comes with the DB stage. */
export interface ShowtimesStorage {
  kind: 'memory';
  seed: ShowtimesSeed;
}

export function createShowtimesModule(deps: {
  storage: ShowtimesStorage;
  movies: MoviesPort;
  seats: SeatsPort;
  clock: Clock;
}): AppModule<ShowtimesService> {
  const repository = new InMemoryShowtimesRepository(deps.storage.seed);
  const service = createShowtimesService({
    repository,
    movies: deps.movies,
    seats: deps.seats,
    clock: deps.clock,
  });
  return { plugin: showtimesRoutes(service), service };
}
