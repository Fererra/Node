import { describe, expect, it, vi } from 'vitest';
import { fixedClock } from '../../../shared/clock.js';
import { NotFoundError } from '../../../shared/errors.js';
import type {
  ShowtimeRecord,
  ShowtimesRepository,
} from './ports/showtimes.repository.js';
import { createShowtimesService } from './showtimes.service.js';

const now = new Date('2026-06-01T12:00:00.000Z');
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

function setup() {
  const rows: ShowtimeRecord[] = [
    { id: 'past', movieId: 'm1', hallId: 'h1', startsAt: at(-1) },
    { id: 'soon', movieId: 'm1', hallId: 'h2', startsAt: at(1) },
    { id: 'other', movieId: 'm2', hallId: 'h2', startsAt: at(5) },
  ];
  // The fake returns what the port promises for the clock's `now`.
  const listFutureByMovie = vi.fn((movieId: string, since: Date) =>
    Promise.resolve(
      rows.filter((r) => r.movieId === movieId && r.startsAt > since),
    ),
  );
  const repository: ShowtimesRepository = {
    listFutureByMovie,
    getByIds: (ids) => Promise.resolve(rows.filter((r) => ids.includes(r.id))),
  };
  const movies = {
    getByIds: vi.fn((ids: readonly string[]) =>
      Promise.resolve(
        [
          { id: 'm1', title: 'One' },
          { id: 'm2', title: 'Two' },
        ].filter((m) => ids.includes(m.id)),
      ),
    ),
  };
  const seats = {
    getHallsByIds: vi.fn((ids: readonly string[]) =>
      Promise.resolve(
        [
          { id: 'h1', number: 1 },
          { id: 'h2', number: 2 },
        ].filter((h) => ids.includes(h.id)),
      ),
    ),
  };
  const service = createShowtimesService({
    repository,
    movies,
    seats,
    clock: fixedClock(now),
  });
  return { service, movies, seats, listFutureByMovie };
}

describe('showtimes service', () => {
  it('asks the repository for showtimes after the clock time, with hall numbers', async () => {
    const { service, listFutureByMovie } = setup();
    const list = await service.listForMovie('m1');
    expect(listFutureByMovie).toHaveBeenCalledWith('m1', now);
    expect(list).toEqual([
      { id: 'soon', startsAt: at(1), hall: { id: 'h2', number: 2 } },
    ]);
  });

  it('throws NotFound for an unknown movie', async () => {
    const { service } = setup();
    await expect(service.listForMovie('nope')).rejects.toBeInstanceOf(
      NotFoundError,
    );
  });

  it('getByIds batches halls and titles: one call each for many showtimes', async () => {
    const { service, movies, seats } = setup();
    const list = await service.getByIds(['past', 'soon', 'other']);
    expect(list).toHaveLength(3);
    expect(list.find((s) => s.id === 'other')).toMatchObject({
      hallNumber: 2,
      movieTitle: 'Two',
    });
    expect(movies.getByIds).toHaveBeenCalledTimes(1);
    expect(seats.getHallsByIds).toHaveBeenCalledTimes(1);
  });
});
