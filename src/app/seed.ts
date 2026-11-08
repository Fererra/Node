import type { MoviesSeed } from '../modules/movies/index.js';
import type { SeatsSeed } from '../modules/seats/index.js';
import type { ShowtimesSeed } from '../modules/showtimes/index.js';

/**
 * Seed data with fixed UUIDs (docs/architecture.md). Times are relative
 * to `now`, so a fixed clock gives fixed data. It feeds in-memory
 * storage, tests and, later, the `db:seed` CLI.
 */
export interface Seed {
  movies: MoviesSeed;
  seats: SeatsSeed;
  showtimes: ShowtimesSeed;
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
  halls: {
    one: fixedId('30000000', 1),
    two: fixedId('30000000', 2),
  },
  showtimes: {
    /** Orbit Nine, hall 1, a day ago. */
    orbitPast: fixedId('50000000', 1),
    /** Orbit Nine, hall 2, exactly `now`: started, not listed. */
    orbitNow: fixedId('50000000', 2),
    /** Orbit Nine, hall 2, in 2 hours. */
    orbitSoon: fixedId('50000000', 3),
    /** Orbit Nine, hall 1, in a day. */
    orbitTomorrow: fixedId('50000000', 4),
    /** Blue Harbor, hall 1, in 3 days. */
    blueHarbor: fixedId('50000000', 5),
    /** Night Garden, hall 2, in a day and 3 hours. */
    nightGarden: fixedId('50000000', 6),
  },
} as const;

const HOUR_MS = 60 * 60 * 1000;

/** Halls: number -> rows x seats per row; the last row is VIP. */
const HALL_LAYOUT = [
  { id: seedIds.halls.one, number: 1, rows: 3, perRow: 4 },
  { id: seedIds.halls.two, number: 2, rows: 2, perRow: 3 },
] as const;

/**
 * Fixed seat id: `40000000-0000-4000-8000-00HH00RR00NN` for hall number
 * HH, row RR, seat NN, e.g. hall 1, row 2, seat 3 -> `...000100020003`.
 */
export function seedSeatId(hall: number, row: number, number: number): string {
  const part = (n: number) => String(n).padStart(4, '0');
  return `40000000-0000-4000-8000-${part(hall)}${part(row)}${part(number)}`;
}

const { genres: g, movies: m } = seedIds;

export function buildSeed(now: Date): Seed {
  const at = (hours: number) => new Date(now.getTime() + hours * HOUR_MS);
  const { halls: h, showtimes: s } = seedIds;
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
    seats: {
      halls: HALL_LAYOUT.map((h) => ({ id: h.id, hallNumber: h.number })),
      seats: HALL_LAYOUT.flatMap((hall) =>
        Array.from({ length: hall.rows }, (_, r) => r + 1).flatMap((row) =>
          Array.from({ length: hall.perRow }, (_, n) => n + 1).map(
            (number) => ({
              id: seedSeatId(hall.number, row, number),
              hallId: hall.id,
              row,
              number,
              seatType:
                row === hall.rows ? ('VIP' as const) : ('STANDARD' as const),
            }),
          ),
        ),
      ),
    },
    showtimes: {
      showtimes: [
        {
          id: s.orbitPast,
          movieId: m.orbitNine,
          hallId: h.one,
          startsAt: at(-24),
        },
        {
          id: s.orbitNow,
          movieId: m.orbitNine,
          hallId: h.two,
          startsAt: at(0),
        },
        {
          id: s.orbitSoon,
          movieId: m.orbitNine,
          hallId: h.two,
          startsAt: at(2),
        },
        {
          id: s.orbitTomorrow,
          movieId: m.orbitNine,
          hallId: h.one,
          startsAt: at(24),
        },
        {
          id: s.blueHarbor,
          movieId: m.blueHarbor,
          hallId: h.one,
          startsAt: at(72),
        },
        {
          id: s.nightGarden,
          movieId: m.nightGarden,
          hallId: h.two,
          startsAt: at(27),
        },
      ],
    },
  };
}
