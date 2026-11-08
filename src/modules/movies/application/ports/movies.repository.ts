import type { MovieDto, MovieSummary } from '../movies.types.js';

export interface MoviesRepository {
  /** All movies with genre names; movies by title, genres by name. */
  listWithGenres(): Promise<MovieDto[]>;
  /** Movies with the given ids, in any order; unknown ids are skipped. */
  getByIds(ids: readonly string[]): Promise<MovieSummary[]>;
}
