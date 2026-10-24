import type { AppModule } from '../../shared/module.js';

export type MoviesService = Record<string, never>;

export function createMoviesModule(): AppModule<MoviesService> {
  return {
    plugin: () => Promise.resolve(),
    service: {},
  };
}
