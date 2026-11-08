// Extra rows for size and concurrency tests (AC-4, AC-12). Test-only, so
// it may write to any table (docs/architecture.md#rules).
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { truncateAll } from '../../src/shared/db/seed.js';
import { buildSeed, seedIds } from '../../src/app/seed.js';
import * as schema from '../../src/shared/db/schema/index.js';
import { NOW } from './app.js';
import { testDb } from './db.js';

const HOUR_MS = 60 * 60 * 1000;
const at = (hours: number) => new Date(NOW.getTime() + hours * HOUR_MS);

/** Rows of the counts the tests compare: nothing else is left. */
async function emptyWithUsers(): Promise<void> {
  const db = testDb();
  await truncateAll(db);
  await db.insert(schema.users).values(buildSeed(NOW).users.users);
}

/** Exactly `n` movies, each with two genres (FR-1). */
export async function moviesWithGenres(n: number): Promise<void> {
  await emptyWithUsers();
  const db = testDb();
  const genres = [
    { id: randomUUID(), name: 'Drama' },
    { id: randomUUID(), name: 'Comedy' },
  ];
  const movies = Array.from({ length: n }, (_, i) => ({
    id: randomUUID(),
    title: `Movie ${String(i + 1).padStart(2, '0')}`,
    durationMin: 90 + i,
    ageLimit: 12,
    releaseYear: 2026,
    description: 'Fixture',
  }));
  await db.insert(schema.genre).values(genres);
  await db.insert(schema.movie).values(movies);
  await db
    .insert(schema.movieGenre)
    .values(
      movies.flatMap((m) =>
        genres.map((g) => ({ movieId: m.id, genreId: g.id })),
      ),
    );
}

export interface ShowtimeFixture {
  showtimeId: string;
  /** Seats of the hall, by row and number; the first `taken` are booked. */
  seatIds: string[];
}

/**
 * One future showtime in a hall of `seats` seats (one row); Bob has
 * booked the first `taken` of them (FR-3, FR-4).
 */
export async function showtimeWithSeats(
  seats: number,
  { taken = 0 } = {},
): Promise<ShowtimeFixture> {
  await emptyWithUsers();
  const db = testDb();
  const movieId = randomUUID();
  const hallId = randomUUID();
  const showtimeId = randomUUID();
  const seatIds = Array.from({ length: seats }, () => randomUUID());

  await db.insert(schema.movie).values({
    id: movieId,
    title: 'Fixture',
    durationMin: 100,
    ageLimit: 0,
    releaseYear: 2026,
    description: 'Fixture',
  });
  await db.insert(schema.cinemaHall).values({ id: hallId, hallNumber: 1 });
  await db.insert(schema.seat).values(
    seatIds.map((id, i) => ({
      id,
      hallId,
      row: 1,
      number: i + 1,
      seatType: 'STANDARD' as const,
    })),
  );
  await db
    .insert(schema.showtime)
    .values({ id: showtimeId, movieId, hallId, startsAt: at(24) });

  if (taken > 0) {
    const bookingId = randomUUID();
    await db.insert(schema.booking).values({
      id: bookingId,
      userId: seedIds.users.bob,
      showtimeId,
      status: 'RESERVED',
      createdAt: NOW,
    });
    await db
      .insert(schema.bookingSeat)
      .values(
        seatIds
          .slice(0, taken)
          .map((seatId) => ({ showtimeId, seatId, bookingId })),
      );
  }
  return { showtimeId, seatIds };
}

/**
 * Alice has `n` RESERVED bookings, each of one seat, for `n` showtimes of
 * `n` movies in `n` halls, so every batch port gets `n` ids (FR-6).
 */
export async function userWithBookings(n: number): Promise<void> {
  await emptyWithUsers();
  const db = testDb();
  const items = Array.from({ length: n }, (_, i) => ({
    movieId: randomUUID(),
    hallId: randomUUID(),
    seatId: randomUUID(),
    showtimeId: randomUUID(),
    bookingId: randomUUID(),
    i,
  }));

  await db.insert(schema.movie).values(
    items.map(({ movieId, i }) => ({
      id: movieId,
      title: `Movie ${String(i + 1)}`,
      durationMin: 100,
      ageLimit: 0,
      releaseYear: 2026,
      description: 'Fixture',
    })),
  );
  await db
    .insert(schema.cinemaHall)
    .values(items.map(({ hallId, i }) => ({ id: hallId, hallNumber: i + 1 })));
  await db.insert(schema.seat).values(
    items.map(({ seatId, hallId }) => ({
      id: seatId,
      hallId,
      row: 1,
      number: 1,
      seatType: 'STANDARD' as const,
    })),
  );
  await db.insert(schema.showtime).values(
    items.map(({ showtimeId, movieId, hallId, i }) => ({
      id: showtimeId,
      movieId,
      hallId,
      startsAt: at(24 + i),
    })),
  );
  await db.insert(schema.booking).values(
    items.map(({ bookingId, showtimeId, i }) => ({
      id: bookingId,
      userId: seedIds.users.alice,
      showtimeId,
      status: 'RESERVED' as const,
      createdAt: new Date(NOW.getTime() - i * 60_000),
    })),
  );
  await db.insert(schema.bookingSeat).values(
    items.map(({ showtimeId, seatId, bookingId }) => ({
      showtimeId,
      seatId,
      bookingId,
    })),
  );
}

/**
 * Makes every `booking_seat` row insert wait `seconds` first, so parallel
 * requests are inside their seat inserts at the same time. Without it the
 * inserts of two requests rarely overlap, and a wrong lock order (a
 * deadlock) would go unnoticed (AC-4).
 */
export async function slowSeatInserts(seconds: number): Promise<void> {
  const db = testDb();
  await db.execute(
    sql.raw(`create or replace function test_slow_seat_insert() returns trigger
      language plpgsql as $$
      begin
        perform pg_sleep(${String(seconds)});
        return new;
      end $$`),
  );
  await db.execute(
    sql`drop trigger if exists test_slow_seat_insert on booking_seat`,
  );
  await db.execute(
    sql`create trigger test_slow_seat_insert before insert on booking_seat
      for each row execute function test_slow_seat_insert()`,
  );
}

export async function removeSlowSeatInserts(): Promise<void> {
  const db = testDb();
  await db.execute(
    sql`drop trigger if exists test_slow_seat_insert on booking_seat`,
  );
  await db.execute(sql`drop function if exists test_slow_seat_insert()`);
}

/** Row counts of the tables a booking writes. */
export async function bookingRowCounts(): Promise<{
  booking: number;
  bookingSeat: number;
  idempotencyKey: number;
}> {
  const db = testDb();
  const count = async (table: string) => {
    const result = await db.execute<{ n: number }>(
      sql.raw(`select count(*)::int as n from ${table}`),
    );
    return result.rows[0]?.n ?? -1;
  };
  return {
    booking: await count('booking'),
    bookingSeat: await count('booking_seat'),
    idempotencyKey: await count('idempotency_key'),
  };
}
