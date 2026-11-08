import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp, type TestApp } from '../support/app.js';
import {
  client,
  halls,
  movies,
  seat,
  showtimes,
  type SeatBody,
} from '../support/client.js';

let t: TestApp;
beforeEach(async () => {
  t = await createTestApp();
});
afterEach(async () => {
  await t.app.close();
});

describe('FR-1: GET /movies', () => {
  it('returns movies by title with genre names by name', async () => {
    const res = await t.app.inject({ method: 'GET', url: '/movies' });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([
      {
        id: movies.blueHarbor,
        title: 'Blue Harbor',
        durationMin: 104,
        ageLimit: 16,
        genres: ['Drama', 'Thriller'],
      },
      {
        id: movies.nightGarden,
        title: 'Night Garden',
        durationMin: 88,
        ageLimit: 6,
        genres: ['Animation', 'Comedy'],
      },
      {
        id: movies.orbitNine,
        title: 'Orbit Nine',
        durationMin: 128,
        ageLimit: 12,
        genres: ['Drama', 'Sci-Fi', 'Thriller'],
      },
      {
        id: movies.quietField,
        title: 'Quiet Field',
        durationMin: 95,
        ageLimit: 0,
        genres: ['Drama'],
      },
    ]);
  });

  it('ignores X-User-Id, even an invalid one (FR-7)', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: '/movies',
      headers: { 'x-user-id': 'not-a-user' },
    });
    expect(res.statusCode).toBe(200);
  });
});

describe('FR-2: GET /movies/:id/showtimes', () => {
  it('returns only future showtimes by startsAt, with the hall', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: `/movies/${movies.orbitNine}/showtimes`,
    });

    expect(res.statusCode).toBe(200);
    // Not listed: orbitPast (a day ago) and orbitNow (starts exactly now).
    expect(res.json()).toEqual([
      {
        id: showtimes.orbitSoon,
        startsAt: '2026-06-01T14:00:00.000Z',
        hall: { id: halls.two, number: 2 },
      },
      {
        id: showtimes.orbitTomorrow,
        startsAt: '2026-06-02T12:00:00.000Z',
        hall: { id: halls.one, number: 1 },
      },
    ]);
  });

  it('returns [] for a movie without showtimes', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: `/movies/${movies.quietField}/showtimes`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('accepts an upper-case UUID', async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: `/movies/${movies.orbitNine.toUpperCase()}/showtimes`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(2);
  });
});

describe('FR-3: GET /showtimes/:id/seats', () => {
  it("returns the hall's seats by row and number with type and taken", async () => {
    const res = await t.app.inject({
      method: 'GET',
      url: `/showtimes/${showtimes.orbitSoon}/seats`,
    });

    expect(res.statusCode).toBe(200);
    const seats = res.json<SeatBody[]>();
    // Hall 2: 2 rows x 3 seats, the last row is VIP.
    expect(seats.map((s) => [s.row, s.number, s.type])).toEqual([
      [1, 1, 'STANDARD'],
      [1, 2, 'STANDARD'],
      [1, 3, 'STANDARD'],
      [2, 1, 'VIP'],
      [2, 2, 'VIP'],
      [2, 3, 'VIP'],
    ]);
    expect(seats[0]).toEqual({
      id: seat(2, 1, 1),
      row: 1,
      number: 1,
      type: 'STANDARD',
      taken: false,
    });
    expect(seats.every((s) => !s.taken)).toBe(true);
  });

  it('allows past showtimes', async () => {
    const res = await client(t.app).seats(showtimes.orbitPast);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(12);
  });
});
