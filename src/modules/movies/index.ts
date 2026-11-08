import type { AppModule } from '../../shared/module.js';
import { createMoviesService } from './application/movies.service.js';
import type { MoviesService } from './application/movies.types.js';
import { moviesRoutes } from './http/movies.routes.js';
import { InMemoryMoviesRepository } from './infrastructure/in-memory-movies.repository.js';
import {
  DrizzleMoviesRepository,
  type PostgresStorage,
} from './infrastructure/drizzle-movies.repository.js';
import type { MoviesSeed } from './infrastructure/movies.seed.js';

export type {
  MovieDto,
  MovieSummary,
  MoviesService,
} from './application/movies.types.js';
export type { MoviesSeed } from './infrastructure/movies.seed.js';

/** Where the module keeps its data. */
export type MoviesStorage =
  { kind: 'memory'; seed: MoviesSeed } | PostgresStorage;

export function createMoviesModule(deps: {
  storage: MoviesStorage;
}): AppModule<MoviesService> {
  const repository =
    deps.storage.kind === 'memory'
      ? new InMemoryMoviesRepository(deps.storage.seed)
      : new DrizzleMoviesRepository(deps.storage.db);
  const service = createMoviesService({ repository });
  return { plugin: moviesRoutes(service), service };
}
