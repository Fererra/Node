import type { MoviesRepository } from './ports/movies.repository.js';
import type { MoviesService } from './movies.types.js';

export function createMoviesService(deps: {
  repository: MoviesRepository;
}): MoviesService {
  const { repository } = deps;
  return {
    listMovies: () => repository.listWithGenres(),
    getByIds: (ids) =>
      ids.length === 0 ? Promise.resolve([]) : repository.getByIds(ids),
  };
}
