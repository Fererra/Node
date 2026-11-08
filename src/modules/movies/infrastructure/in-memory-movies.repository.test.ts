import { describe, expect, it } from 'vitest';
import { InMemoryMoviesRepository } from './in-memory-movies.repository.js';

const repository = new InMemoryMoviesRepository({
  genres: [
    { id: 'g1', name: 'Drama' },
    { id: 'g2', name: 'Comedy' },
  ],
  movies: [
    {
      id: 'm2',
      title: 'b',
      durationMin: 90,
      ageLimit: 0,
      releaseYear: 2020,
      description: '',
    },
    {
      id: 'm1',
      title: 'B',
      durationMin: 90,
      ageLimit: 0,
      releaseYear: 2020,
      description: '',
    },
    {
      id: 'm3',
      title: 'A',
      durationMin: 90,
      ageLimit: 0,
      releaseYear: 2020,
      description: '',
    },
  ],
  movieGenres: [
    { movieId: 'm3', genreId: 'g1' },
    { movieId: 'm3', genreId: 'g2' },
  ],
});

describe('InMemoryMoviesRepository', () => {
  it('orders movies by title (code point order), genres by name', async () => {
    const movies = await repository.listWithGenres();
    expect(movies.map((m) => m.title)).toEqual(['A', 'B', 'b']);
    expect(movies[0]?.genres).toEqual(['Comedy', 'Drama']);
    expect(movies[1]?.genres).toEqual([]);
  });

  it('getByIds skips unknown ids', async () => {
    expect(await repository.getByIds(['m1', 'nope'])).toEqual([
      { id: 'm1', title: 'B' },
    ]);
  });
});
