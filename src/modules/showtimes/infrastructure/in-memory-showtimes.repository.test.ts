import { describe, expect, it } from 'vitest';
import { InMemoryShowtimesRepository } from './in-memory-showtimes.repository.js';

const now = new Date('2026-06-01T12:00:00.000Z');
const at = (minutes: number) => new Date(now.getTime() + minutes * 60_000);

const repository = new InMemoryShowtimesRepository({
  showtimes: [
    { id: 'later', movieId: 'm1', hallId: 'h1', startsAt: at(120) },
    { id: 'past', movieId: 'm1', hallId: 'h1', startsAt: at(-1) },
    { id: 'now', movieId: 'm1', hallId: 'h1', startsAt: at(0) },
    { id: 'soon', movieId: 'm1', hallId: 'h2', startsAt: at(1) },
    { id: 'other', movieId: 'm2', hallId: 'h2', startsAt: at(5) },
  ],
});

describe('InMemoryShowtimesRepository', () => {
  it('lists only startsAt > now (not one starting exactly now), by startsAt', async () => {
    const list = await repository.listFutureByMovie('m1', now);
    expect(list.map((s) => s.id)).toEqual(['soon', 'later']);
  });

  it('getByIds includes past showtimes and skips unknown ids', async () => {
    const list = await repository.getByIds(['past', 'x']);
    expect(list.map((s) => s.id)).toEqual(['past']);
  });
});
