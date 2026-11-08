import type { AppModule } from '../../shared/module.js';
import { createMoviesService } from './application/movies.service.js';
import type { MoviesService } from './application/movies.types.js';
import { moviesRoutes } from './http/movies.routes.js';
import { InMemoryMoviesRepository } from './infrastructure/in-memory-movies.repository.js';
import type { MoviesSeed } from './infrastructure/movies.seed.js';

export type {
  MovieDto,
  MovieSummary,
  MoviesService,
} from './application/movies.types.js';
export type { MoviesSeed } from './infrastructure/movies.seed.js';

/** Where the module keeps its data; `postgres` comes with the DB stage. */
export interface MoviesStorage {
  kind: 'memory';
  seed: MoviesSeed;
}

export function createMoviesModule(deps: {
  storage: MoviesStorage;
}): AppModule<MoviesService> {
  const repository = new InMemoryMoviesRepository(deps.storage.seed);
  const service = createMoviesService({ repository });
  return { plugin: moviesRoutes(service), service };
}
