import type { MoviesSeed } from '../modules/movies/index.js';

/**
 * Seed data with fixed UUIDs (docs/architecture.md). Times are relative
 * to `now`, so a fixed clock gives fixed data. It feeds in-memory
 * storage, tests and, later, the `db:seed` CLI.
 */
export interface Seed {
  movies: MoviesSeed;
}

/** `<prefix>-0000-4000-8000-<n, 12 digits>`: one prefix per entity type. */
function fixedId(prefix: string, n: number): string {
  return `${prefix}-0000-4000-8000-${String(n).padStart(12, '0')}`;
}

export const seedIds = {
  genres: {
    animation: fixedId('10000000', 1),
    comedy: fixedId('10000000', 2),
    drama: fixedId('10000000', 3),
    sciFi: fixedId('10000000', 4),
    thriller: fixedId('10000000', 5),
  },
  movies: {
    blueHarbor: fixedId('20000000', 1),
    nightGarden: fixedId('20000000', 2),
    orbitNine: fixedId('20000000', 3),
    /** A movie without showtimes. */
    quietField: fixedId('20000000', 4),
  },
} as const;

const { genres: g, movies: m } = seedIds;

export function buildSeed(): Seed {
  return {
    movies: {
      genres: [
        { id: g.animation, name: 'Animation' },
        { id: g.comedy, name: 'Comedy' },
        { id: g.drama, name: 'Drama' },
        { id: g.sciFi, name: 'Sci-Fi' },
        { id: g.thriller, name: 'Thriller' },
      ],
      movies: [
        {
          id: m.orbitNine,
          title: 'Orbit Nine',
          durationMin: 128,
          ageLimit: 12,
          releaseYear: 2026,
          description: 'A crew loses contact with Earth.',
        },
        {
          id: m.blueHarbor,
          title: 'Blue Harbor',
          durationMin: 104,
          ageLimit: 16,
          releaseYear: 2025,
          description: 'A fishing town keeps a secret.',
        },
        {
          id: m.quietField,
          title: 'Quiet Field',
          durationMin: 95,
          ageLimit: 0,
          releaseYear: 2024,
          description: 'A year on a small farm.',
        },
        {
          id: m.nightGarden,
          title: 'Night Garden',
          durationMin: 88,
          ageLimit: 6,
          releaseYear: 2026,
          description: 'Plants come alive after dark.',
        },
      ],
      movieGenres: [
        { movieId: m.orbitNine, genreId: g.thriller },
        { movieId: m.orbitNine, genreId: g.sciFi },
        { movieId: m.orbitNine, genreId: g.drama },
        { movieId: m.blueHarbor, genreId: g.thriller },
        { movieId: m.blueHarbor, genreId: g.drama },
        { movieId: m.quietField, genreId: g.drama },
        { movieId: m.nightGarden, genreId: g.comedy },
        { movieId: m.nightGarden, genreId: g.animation },
      ],
    },
  };
}
