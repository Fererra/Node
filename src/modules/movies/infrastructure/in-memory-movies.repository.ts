import { compareText } from '../../../shared/kernel/compare.js';
import type { MoviesRepository } from '../application/ports/movies.repository.js';
import type { MovieDto, MovieSummary } from '../application/movies.types.js';
import type { MoviesSeed } from './movies.seed.js';

export class InMemoryMoviesRepository implements MoviesRepository {
  readonly #seed: MoviesSeed;

  constructor(seed: MoviesSeed) {
    this.#seed = structuredClone(seed);
  }

  listWithGenres(): Promise<MovieDto[]> {
    const genreName = new Map(this.#seed.genres.map((g) => [g.id, g.name]));
    const movies = this.#seed.movies
      .map((movie) => ({
        id: movie.id,
        title: movie.title,
        durationMin: movie.durationMin,
        ageLimit: movie.ageLimit,
        genres: this.#seed.movieGenres
          .filter((mg) => mg.movieId === movie.id)
          .map((mg) => genreName.get(mg.genreId))
          .filter((name) => name !== undefined)
          .sort(compareText),
      }))
      .sort((a, b) => compareText(a.title, b.title) || compareText(a.id, b.id));
    return Promise.resolve(movies);
  }

  getByIds(ids: readonly string[]): Promise<MovieSummary[]> {
    const wanted = new Set(ids);
    return Promise.resolve(
      this.#seed.movies
        .filter((m) => wanted.has(m.id))
        .map(({ id, title }) => ({ id, title })),
    );
  }
}
